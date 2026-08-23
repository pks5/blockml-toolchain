declare module "libxmljs2" {
  interface ValidationError {
    message: string;
    line?: number;
    column?: number;
  }

  interface XmlDocument {
    validate(xsdDoc: XmlDocument): boolean;
    validationErrors: ValidationError[];
  }

  function parseXml(source: string): XmlDocument;

  const libxmljs: {
    parseXml: typeof parseXml;
  };

  export default libxmljs;
}
