import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { TransformError } from "../src/execution/errors.js";
import { resolvePendingExecution } from "../src/execution/resolve.js";
import { MODEL_TRANSFORMATION_FQN } from "../src/execution/constants.js";
import {
  LIBRARY,
  EXECUTION_ID,
  pendingExecutionXml,
  pendingFqn,
  plainBlockXml,
  writeProject,
} from "./fixture.js";

const TMP = join(import.meta.dirname, ".tmp-transformer-resolve");

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
    const resolved = resolvePendingExecution(pendingFqn("JokeTest"), TMP);
    expect(resolved.fqn).toBe(pendingFqn("JokeTest"));
    expect(resolved.libraryFqn).toBe(LIBRARY);
    expect(resolved.originalName).toBe("JokeTest");
    expect(resolved.document.block.baseType).toBe(MODEL_TRANSFORMATION_FQN);
  });

  it("rejects a non-ModelTransformation FQN", () => {
    writeProject(TMP, {
      "blocks/com/example/model/Other.bml": plainBlockXml("Other"),
    });
    expect(() =>
      resolvePendingExecution(`${LIBRARY}.Other`, TMP),
    ).toThrow(TransformError);
    try {
      resolvePendingExecution(`${LIBRARY}.Other`, TMP);
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
      resolvePendingExecution(`${LIBRARY}._meta.transform.succeeded.OldOne`, TMP),
    ).toThrow(/pending/);
  });

  it("rejects a pending execution that is missing status=Pending", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" }).replace(
      ">Pending</value>",
      ">Running</value>",
    );
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
      /status=Pending/,
    );
  });

  it("rejects a pending execution that already has executionId", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        executionId: EXECUTION_ID,
      }),
    });
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
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
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
      /must not have sequence/,
    );
  });

  it("allows resultMappings and parametersSource on a pending execution", () => {
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": pendingExecutionXml({
        name: "JokeTest",
        resultMappings: [{ source: "com.example.model.Poem.properties.title" }],
        parametersSource: "com.example.model.Poem.properties.title",
      }),
    });
    const resolved = resolvePendingExecution(pendingFqn("JokeTest"), TMP);
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
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
      /must not have result/,
    );
  });

  it("rejects an abstract ModelOperation instance", () => {
    const xml = pendingExecutionXml({ name: "JokeTest" })
      .replaceAll("workflow:AgenticOperation", "workflow:ModelOperation");
    writeProject(TMP, {
      "blocks/com/example/model/_meta/transform/pending/JokeTest.bml": xml,
    });
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
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
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
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
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
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
    const resolved = resolvePendingExecution(pendingFqn("JokeTest"), TMP);
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
    expect(() => resolvePendingExecution(pendingFqn("JokeTest"), TMP)).toThrow(
      /must not have exception/,
    );
  });
});
