export class MockPluginTarget {
  name = "mock-plugin";
  accepts = ["library", "corpus", "auto"];

  render() {
    return {
      files: [{ path: "mock-plugin.txt", content: "mock-plugin-ok" }],
    };
  }
}

export default MockPluginTarget;
