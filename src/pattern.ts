import type {
  Expression,
  LegacyPattern,
  Pattern,
  StoredPattern,
  Text,
} from "./types.js";

export const DEFAULT_VARIABLE_REFERENCE_PATTERN = ["{", "}"];

type Token =
  | { type: "text"; value: string }
  | { type: "variable"; name: string };

/**
 * Splits a message into text and variable tokens.
 *
 * @example
 *   tokenize("Hello {name}!", ["{", "}"])
 *   // [{type: "text", value: "Hello "}, {type: "variable", name: "name"}, {type: "text", value: "!"}]
 */
function tokenize(text: string, variableReferencePattern: string[]): Token[] {
  const opening = variableReferencePattern[0] || "{";
  const closing = variableReferencePattern[1] ?? "";
  const expression = closing
    ? new RegExp(
        `(${escapeRegExp(opening)}[\\s\\S]+?${escapeRegExp(closing)})`,
        "g",
      )
    : new RegExp(`(${escapeRegExp(opening)}\\w+)`, "g");

  return text
    .split(expression)
    .filter((element) => element !== "")
    .map((element) => {
      if (isVariableReference(element, opening, closing)) {
        return {
          type: "variable" as const,
          name: closing
            ? element.slice(opening.length, -closing.length)
            : element.slice(opening.length),
        };
      }
      return { type: "text" as const, value: element };
    });
}

function isVariableReference(
  text: string,
  opening: string,
  closing: string,
): boolean {
  return closing
    ? text.startsWith(opening) &&
        text.endsWith(closing) &&
        text.length > opening.length + closing.length
    : text.startsWith(opening) && text.length > opening.length;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Current message model (SDK v2)
// ---------------------------------------------------------------------------

export function parsePattern(
  text: string,
  variableReferencePattern: string[],
): Pattern {
  return tokenize(text, variableReferencePattern).map((token) =>
    token.type === "variable"
      ? {
          type: "expression" as const,
          arg: { type: "variable-reference" as const, name: token.name },
        }
      : { type: "text" as const, value: token.value },
  );
}

export function serializePattern(
  pattern: StoredPattern,
  variableReferencePattern: string[],
): string {
  const opening = variableReferencePattern[0] || "{";
  const closing = variableReferencePattern[1] ?? "";
  let result = "";

  for (const part of pattern) {
    // the discriminant is checked at runtime; casts narrow the loose
    // StoredPattern union
    switch (part.type) {
      case "text":
        result += (part as Text).value;
        break;
      case "expression": {
        const expression = part as Expression;
        if (
          expression.arg.type !== "variable-reference" ||
          expression.annotation !== undefined
        ) {
          throw new Error(
            "Only unannotated variable references are supported by the YAML plugin.",
          );
        }
        result += `${opening}${expression.arg.name}${closing}`;
        break;
      }
      default:
        throw new Error(
          `Pattern elements of type "${part.type}" are not supported by the YAML plugin.`,
        );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Legacy message model (plugin API v4)
// ---------------------------------------------------------------------------

export function parseLegacyPattern(
  text: string,
  variableReferencePattern: string[],
): LegacyPattern {
  return tokenize(text, variableReferencePattern).map((token) =>
    token.type === "variable"
      ? { type: "VariableReference" as const, name: token.name }
      : { type: "Text" as const, value: token.value },
  );
}

export function serializeLegacyPattern(
  pattern: LegacyPattern,
  variableReferencePattern: string[],
): string {
  const opening = variableReferencePattern[0] || "{";
  const closing = variableReferencePattern[1] ?? "";
  let result = "";

  for (const element of pattern) {
    switch (element.type) {
      case "Text":
        result += element.value;
        break;
      case "VariableReference":
        result += `${opening}${element.name}${closing}`;
        break;
      default:
        throw new Error(
          `Unknown message pattern element of type: ${(element as { type: string }).type}`,
        );
    }
  }

  return result;
}
