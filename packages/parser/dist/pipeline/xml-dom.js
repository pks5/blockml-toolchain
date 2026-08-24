import { DOMParser } from "@xmldom/xmldom";
const LOCATION_SUFFIX = /@[^[]*\[line:(\d+),col:(\d+)\]\s*$/;
function locationFromMessage(msg) {
    const match = msg.match(LOCATION_SUFFIX);
    if (!match) {
        return { message: msg.trim(), line: 1, column: 1 };
    }
    return {
        message: msg.slice(0, match.index).trim(),
        line: Number(match[1]),
        column: Number(match[2]),
    };
}
function locationFromContext(msg, context) {
    const fromMsg = locationFromMessage(msg);
    const locator = context?.locator ?? context;
    const line = locator?.lineNumber ?? fromMsg.line;
    const column = locator?.columnNumber ?? fromMsg.column;
    return { message: fromMsg.message, line, column };
}
export function parseXmlDom(source, _filePath) {
    const errors = [];
    const parser = new DOMParser({
        locator: true,
        onError(level, msg, context) {
            const loc = locationFromContext(String(msg), context);
            errors.push({
                level,
                message: loc.message,
                line: loc.line,
                column: loc.column,
            });
        },
    });
    try {
        const document = parser.parseFromString(source, "text/xml");
        return { document, errors };
    }
    catch (e) {
        const loc = e
            .locator;
        if (errors.length === 0) {
            const fromMsg = locationFromMessage(e instanceof Error ? e.message : String(e));
            errors.push({
                level: "fatalError",
                message: fromMsg.message,
                line: loc?.lineNumber ?? fromMsg.line,
                column: loc?.columnNumber ?? fromMsg.column,
            });
        }
        else if (loc?.lineNumber && errors[0].line <= 1) {
            errors[0].line = loc.lineNumber;
            errors[0].column = loc.columnNumber ?? errors[0].column;
        }
        return { document: null, errors };
    }
}
export function getParseErrors(doc) {
    const errors = [];
    const elements = doc.getElementsByTagName("parsererror");
    for (let i = 0; i < elements.length; i++) {
        const el = elements.item(i);
        if (el?.textContent) {
            errors.push(el.textContent);
        }
    }
    return errors;
}
export function documentElement(doc) {
    return doc.documentElement;
}
//# sourceMappingURL=xml-dom.js.map