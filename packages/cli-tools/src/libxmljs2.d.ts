declare module "libxmljs2" {
  interface ValidationError {
    message: string;
    line?: number;
    column?: number;
  }

  interface XmlDocument {
    validate(schema: XmlSchema): boolean;
    validationErrors: ValidationError[];
  }

  interface XmlSchema {}

  function parseXml(source: string): XmlDocument;
  function parseXmlSchema(xsdDoc: XmlDocument): XmlSchema;

  const libxmljs: {
    parseXml: typeof parseXml;
    parseXmlSchema: typeof parseXmlSchema;
  };

  export default libxmljs;
}
