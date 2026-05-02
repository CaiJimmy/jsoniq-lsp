import { ParseTree } from "antlr4ng";
import { FlowrExprContext, FlowrStatementContext, FunctionDeclContext } from "grammar/jsoniqParser.js";

/**
 * A new variable scope is introduced by:
 * - Function declarations (introducing a new function scope)
 * - FLWOR expressions and statements (introducing a new FLWOR scope)
 * Each of these scopes can contain variable declarations that should not be visible outside of that scope, 
 *  so we push a new scope frame onto the stack when we enter these nodes, and pop it when we exit.
 */
const newScopeNodeTypes = [FunctionDeclContext, FlowrExprContext, FlowrStatementContext];

export function isNewScopeNode(node: ParseTree): node is InstanceType<typeof newScopeNodeTypes[number]> {
    return newScopeNodeTypes.some((type) => node instanceof type);
}