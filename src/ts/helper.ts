import { FieldDescriptorProto } from "google-protobuf/google/protobuf/descriptor_pb";
import { isWellKnown, wellKnownType } from "./well-known-type";
import { FieldSchema, HTTPRule } from "../types";
import { primitiveType } from "./primitive-type";
import { Helper } from "../helper";
import { Config } from "../config";
import { ExportMap } from "../export-map";
import { ignoreProto, wellKnownProto } from "../ts/well-known-proto";
import { dependencyFilename, dependencyName } from "../utils";
import { HTTPMethod } from "../lib";

export class TSHelper extends Helper {
  config: Config.AsObject;

  constructor(config: Config, private map: ExportMap) {
    super();
    this.config = config.asObject;
  }

  mapImports(dependencies: string[], filename: string) {
    return dependencies
      .filter(dep => {
        return (
          this.filterDependencies(dep) && this.map.hasDependency(filename, dep)
        );
      })
      .map(dep => this.dependency(dep, filename));
  }

  mapHTTPOptions(http: HTTPRule): { method: HTTPMethod; path: string } {
    return ["post", "put", "get", "pb_delete", "patch"].reduce(
      (acc, method) => {
        if (http[method]) {
          return {
            method: method,
            path: http[method]
          };
        }
        return acc;
      },
      {} as any
    );
  }

  mapFieldName(name: string): string {
    return name;
  }

  mapFieldType(
    proto: FieldDescriptorProto.AsObject,
    filename: string
  ): FieldSchema {
    if (
      proto.type === FieldDescriptorProto.Type.TYPE_ENUM ||
      proto.type === FieldDescriptorProto.Type.TYPE_MESSAGE
    ) {
      return this.mapFieldTypeName(proto.typeName, filename);
    }
    return primitiveType(proto);
  }

  mapFieldTypeName(fullTypeName: string, filename: string) {
    if (isWellKnown(fullTypeName) && this.config.jsonFormat) {
      return wellKnownType(fullTypeName);
    }

    // .foo.bar -> foo.bar
    fullTypeName = fullTypeName.slice(1);

    const definition = this.map.getDefinition(fullTypeName);
    const typeName = this.typeName(fullTypeName, definition.packageName);

    // within namespace
    if (filename === definition.filename) {
      return {
        type: typeName
      };
    }

    if (this.config.ignorePackage) {
      return {
        type: `${dependencyName(definition.filename)}.${typeName}`
      };
    }

    return {
      type: `${dependencyName(definition.filename)}.${fullTypeName}`
    };
  }

  private filterDependencies(dependency: string) {
    if (this.config.jsonFormat) {
      return (
        ignoreProto.indexOf(dependency) === -1 && !wellKnownProto[dependency]
      );
    }
    return ignoreProto.indexOf(dependency) === -1;
  }

  private typeName(fullTypeName: string, packageName: string) {
    return fullTypeName.slice(packageName.length);
  }

  private dependency(dependency: string, filename: string) {
    return {
      name: dependencyName(dependency),
      filename: dependencyFilename(dependency, filename)
    };
  }
}
