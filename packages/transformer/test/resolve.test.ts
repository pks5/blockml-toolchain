import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { TransformError } from "../src/execution/errors.js";
import { resolvePendingExecution } from "../src/execution/resolve.js";
import { resolveTargetLibrary } from "../src/execution/target-library.js";
import { MODEL_TRANSFORMATION_FQN } from "../src/execution/constants.js";
import {
  LIBRARY,
  EXECUTION_ID,
  availableFqn,
  pendingExecutionXml,
  pendingFqn,
  plainBlockXml,
  writeProject,
  fixtureTempDir,
} from "./fixture.js";

function resolveAt(fqn: string): ReturnType<typeof resolvePendingExecution> {
  return resolvePendingExecution(fqn, TMP, resolveTargetLibrary(TMP));
}

const TMP = fixtureTempDir("transformer-resolve");

describe("resolvePendingExecution", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("resolves a valid pending ModelTransformation", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
      }),
    });
    const resolved = resolveAt(pendingFqn("JokeTest"));
    expect(resolved.fqn).toBe(pendingFqn("JokeTest"));
    expect(resolved.libraryFqn).toBe(LIBRARY);
    expect(resolved.libraryRoot.replaceAll("\\", "/")).toMatch(
      /blocks\/com\/example\/model$/,
    );
    expect(resolved.originalName).toBe("JokeTest");
    expect(resolved.document.block.baseType).toBe(MODEL_TRANSFORMATION_FQN);
  });

  it("resolves a pending ModelTransformation outside _meta.transform.pending", () => {
    const xml = pendingExecutionXml({ name: "CreateJoke", template: true })
      .replaceAll(`${LIBRARY}._meta.transform.pending`, `${LIBRARY}.program`)
      .replaceAll("xmlns:pending=", "xmlns:program=")
      .replaceAll("<type>pending:", "<type>program:");
    writeProject(TMP, {
      "blocks/com/example/model/program/CreateJoke.bml": xml,
    });
    const resolved = resolveAt(`${LIBRARY}.program.CreateJoke`);
    expect(resolved.fqn).toBe(`${LIBRARY}.program.CreateJoke`);
    expect(resolved.libraryFqn).toBe(LIBRARY);
    expect(resolved.originalName).toBe("CreateJoke");
  });

  it("rejects a non-ModelTransformation FQN", () => {
    writeProject(TMP, {
      "blocks/com/example/model/Other.bml": plainBlockXml("Other"),
    });
    expect(() => resolveAt(`${LIBRARY}.Other`)).toThrow(TransformError);
    try {
      resolveAt(`${LIBRARY}.Other`);
    } catch (error) {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("resolve");
      expect((error as TransformError).exitCode).toBe(2);
    }
  });

  it("rejects an execution outside _meta.transform.pending", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/succeeded/OldOne.bml": pendingExecutionXml({
        name: "OldOne",
      })
        .replaceAll("_meta.transform.pending", "_meta.transform.succeeded")
        .replaceAll("xmlns:pending=", "xmlns:succeeded=")
        .replaceAll("<type>pending:", "<type>succeeded:"),
    });
    const { registry } = bootstrapFullProjectRegistry({ rootDir: TMP });
    expect(registry.get(`${LIBRARY}._meta.transform.succeeded.OldOne`)).toBeTruthy();
    expect(() =>
      resolveAt(`${LIBRARY}._meta.transform.succeeded.OldOne`),
    ).toThrow(/pending or available/);
  });

  it("resolves an available template ModelTransformation", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml":
        pendingExecutionXml({
          name: "JokeTest",
          segment: "available",
          template: true,
        }),
    });
    const resolved = resolveAt(availableFqn("JokeTest"));
    expect(resolved.fqn).toBe(availableFqn("JokeTest"));
    expect(resolved.originalName).toBe("JokeTest");
  });

  it("rejects a pending ModelTransformation with template=true", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml":
        pendingExecutionXml({
          name: "JokeTest",
          template: true,
        }),
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /pending and must have template=false/,
    );
  });

  it("rejects an available ModelTransformation with template=false", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/available/JokeTest.bml":
        pendingExecutionXml({
          name: "JokeTest",
          segment: "available",
        }),
    });
    expect(() => resolveAt(availableFqn("JokeTest"))).toThrow(
      /available and must have template=true/,
    );
  });

  it("rejects a ModelTransformation outside _meta.transform without template=true", () => {
    const xml = pendingExecutionXml({ name: "CreateJoke" })
      .replaceAll(`${LIBRARY}._meta.transform.pending`, `${LIBRARY}.program`)
      .replaceAll("xmlns:pending=", "xmlns:program=")
      .replaceAll("<type>pending:", "<type>program:");
    writeProject(TMP, {
      "blocks/com/example/model/program/CreateJoke.bml": xml,
    });
    expect(() => resolveAt(`${LIBRARY}.program.CreateJoke`)).toThrow(
      /outside _meta.transform and must have template=true/,
    );
  });

  it("rejects a pending execution that is missing status=Pending", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      ">Pending</value>",
      ">Running</value>",
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(/status=Pending/);
  });

  it("rejects a pending execution that already has executionId", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        executionId: EXECUTION_ID,
      }),
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /must not have executionId/,
    );
  });

  it("rejects a pending execution that already has sequence", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      "</properties>",
      `    <sequence override="true" type="org.blockml.bml.type.Integer">
      <value>1</value>
    </sequence>
  </properties>`,
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /must not have sequence/,
    );
  });

  it("allows resultMappings and parameterMappings on a pending execution", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Poem.properties.title" }],
        parameterMappings: [
          { source: "com.example.model.Poem.properties.title" },
        ],
      }),
    });
    const resolved = resolveAt(pendingFqn("JokeTest"));
    expect(resolved.fqn).toBe(pendingFqn("JokeTest"));
  });

  it("rejects a pending execution that already has result", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      "</properties>",
      `    <result override="true" type="org.blockml.bml.type.Text">
      <value>too early</value>
    </result>
  </properties>`,
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /must not have result/,
    );
  });

  it("rejects an abstract ModelOperation instance", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" })
      .replaceAll("workflow:AgenticOperation", "workflow:ModelOperation");
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /concrete subtype/,
    );
  });

  it("rejects an AgenticOperation that has no task", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      /<task>[\s\S]*?<\/task>/,
      "",
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /AgenticOperation 1 has no configured task/,
    );
  });

  it("rejects a ToolOperation that has no command", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" })
      .replaceAll("workflow:AgenticOperation", "workflow:ToolOperation")
      .replace(/<task>[\s\S]*?<\/task>/, "");
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /ToolOperation 1 must have command set/,
    );
  });

  it("resolves a pending ToolOperation with command", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" })
      .replaceAll("workflow:AgenticOperation", "workflow:ToolOperation")
      .replace(
        /<task>[\s\S]*?<\/task>/,
        "<command>blockml</command>\n          <args>validate</args>",
      );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    const resolved = resolveAt(pendingFqn("JokeTest"));
    expect(resolved.fqn).toBe(pendingFqn("JokeTest"));
  });

  it("rejects a pending execution that already has exception", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      "</aggregations>",
      `    <exception override="true">
      <composition>
        <workflow:ResultException>
          <message>too early</message>
        </workflow:ResultException>
      </composition>
    </exception>
  </aggregations>`,
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolveAt(pendingFqn("JokeTest"))).toThrow(
      /must not have exception/,
    );
  });
});
