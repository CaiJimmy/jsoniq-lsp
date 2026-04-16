package org.jsoniq.lsp.rumble;

import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RumbleTypeInferencerTest {

    private final RumbleTypeInferencer inferencer = new RumbleTypeInferencer();

    @Test
    void inferEmptyQueryReturnsNoErrorAndNoTypes() {
        RumbleTypeInferencer.InferenceResult result = this.inferencer.infer("");

        assertNull(result.error());
        assertTrue(result.variableTypes().isEmpty());
        assertTrue(result.functionTypes().isEmpty());
    }

    @Test
    void inferSimpleLetCollectsVariableType() {
        String query = "let $x := 1 return $x";

        RumbleTypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());

        Optional<RumbleTypeInferencer.VariableType> letVariableType = result.variableTypes()
                .stream()
                .filter(type -> "LetVariableDeclaration".equals(type.nodeKind()))
                .filter(type -> "x".equals(type.name()))
                .findFirst();

        assertTrue(letVariableType.isPresent());
        assertEquals("xs:integer", letVariableType.get().type());
    }

    @Test
    void inferFunctionDeclarationCollectsFunctionTypeAndParameters() {
        String query = "declare function local:f($a as integer, $b) { $a + 1 };";

        RumbleTypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());
        assertFalse(result.functionTypes().isEmpty());

        Optional<RumbleTypeInferencer.FunctionType> functionType = result.functionTypes()
                .stream()
                .filter(type -> "local:f".equals(type.name()))
                .findFirst();

        assertTrue(functionType.isPresent());
        assertEquals("xs:integer", functionType.get().parameterTypes().get("$a"));
        assertEquals("item*", functionType.get().parameterTypes().get("$b"));
        assertEquals("item*", functionType.get().returnType());
    }

    @Test
    void inferInvalidQueryReturnsError() {
        RumbleTypeInferencer.InferenceResult result = this.inferencer.infer("let $x := return");

        assertNotNull(result.error());
        assertTrue(result.variableTypes().isEmpty());
        assertTrue(result.functionTypes().isEmpty());
    }

    @Test
    void inferLetShadowingCollectsBothVariableTypes() {
        String query = """
                let $x := 1
                return (
                  let $x := "shadow"
                  return $x
                )
                """;

        RumbleTypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());

        Set<String> xTypes = result.variableTypes()
                .stream()
                .filter(type -> "LetVariableDeclaration".equals(type.nodeKind()))
                .filter(type -> "x".equals(type.name()))
                .map(RumbleTypeInferencer.VariableType::type)
                .collect(Collectors.toSet());

        assertTrue(xTypes.contains("xs:integer"));
        assertTrue(xTypes.contains("xs:string"));
    }
}
