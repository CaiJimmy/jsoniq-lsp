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

class TypeInferencerTest {

    private final TypeInferencer inferencer = new TypeInferencer();

    @Test
    void inferEmptyQueryReturnsNoErrorAndNoTypes() {
        TypeInferencer.InferenceResult result = this.inferencer.infer("");

        assertNull(result.error());
        assertTrue(result.variableTypes().isEmpty());
        assertTrue(result.functionTypes().isEmpty());
    }

    @Test
    void inferSimpleLetCollectsVariableType() {
        String query = "let $x := 1 return $x";

        TypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());

        Optional<TypeInferencer.VariableType> letVariableType = result.variableTypes()
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

        TypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());
        assertFalse(result.functionTypes().isEmpty());

        Optional<TypeInferencer.FunctionType> functionType = result.functionTypes()
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
        TypeInferencer.InferenceResult result = this.inferencer.infer("let $x := return");

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

        TypeInferencer.InferenceResult result = this.inferencer.infer(query);

        assertNull(result.error());

        Set<String> xTypes = result.variableTypes()
                .stream()
                .filter(type -> "LetVariableDeclaration".equals(type.nodeKind()))
                .filter(type -> "x".equals(type.name()))
                .map(TypeInferencer.VariableType::type)
                .collect(Collectors.toSet());

        assertTrue(xTypes.contains("xs:integer"));
        assertTrue(xTypes.contains("xs:string"));
    }
}
