import { emitBlockXsd } from "./emit-block-xsd.js";
import { resolveXsdOptions } from "./options.js";
export class XsdTarget {
    name = "xsd";
    accepts = ["library", "corpus", "auto"];
    render(request, ctx) {
        resolveXsdOptions(request.targetOptions);
        return {
            files: [
                {
                    path: "core/block.xsd",
                    content: emitBlockXsd(ctx.session.typeRegistry),
                },
            ],
        };
    }
}
//# sourceMappingURL=xsd-target.js.map