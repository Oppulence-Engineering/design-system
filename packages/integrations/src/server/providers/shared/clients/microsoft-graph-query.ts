import {
  definedFields,
  optionalInputNumber,
  optionalInputString,
} from "../sdk";

type GraphInput = Readonly<Record<string, unknown>>;

/**
 * Maps the OData system query options every Graph collection endpoint accepts.
 * Values are passed through as provider parameters, never interpolated into a
 * path, so a caller cannot reshape the request target.
 */
export function graphCollectionQuery(
  input: GraphInput,
): Record<string, unknown> {
  return definedFields({
    $select: optionalInputString(input, "select"),
    $filter: optionalInputString(input, "filter"),
    $orderby: optionalInputString(input, "orderBy", "orderby"),
    $search: optionalInputString(input, "search"),
    $expand: optionalInputString(input, "expand"),
    $top: optionalInputNumber(input, "top", "pageSize", "maxResults"),
    $skip: optionalInputNumber(input, "skip"),
    $skiptoken: optionalInputString(input, "skipToken", "pageToken"),
  });
}

/** The subset that applies to a single-entity read. */
export function graphEntityQuery(input: GraphInput): Record<string, unknown> {
  return definedFields({
    $select: optionalInputString(input, "select"),
    $expand: optionalInputString(input, "expand"),
  });
}
