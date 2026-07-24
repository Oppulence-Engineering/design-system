import { describe, expect, it } from "vitest";
import {
  resolveCollaborationAccess,
  resolveEffectiveAccess,
} from "./collaboration";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("resolveCollaborationAccess", () => {
  it("gives owners write access even when a document ACL exists", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [{ permission: "view", userId: null }],
        teamRole: "owner",
        userId: USER_ID,
      }),
    ).toBe("write");
  });

  it("uses workspace roles when a document has no ACL", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [],
        teamRole: "member",
        userId: USER_ID,
      }),
    ).toBe("write");
    expect(
      resolveCollaborationAccess({
        permissions: [],
        teamRole: "viewer",
        userId: USER_ID,
      }),
    ).toBe("read");
  });

  it("prefers a user ACL over the team ACL", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [
          { permission: "edit", userId: null },
          { permission: "view", userId: USER_ID },
        ],
        teamRole: "member",
        userId: USER_ID,
      }),
    ).toBe("read");
  });

  it("never elevates a workspace viewer to write access", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [{ permission: "admin", userId: USER_ID }],
        teamRole: "viewer",
        userId: USER_ID,
      }),
    ).toBe("read");
  });

  it("denies unlisted members when a document has a user ACL", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [
          {
            permission: "edit",
            userId: "22222222-2222-4222-8222-222222222222",
          },
        ],
        teamRole: "member",
        userId: USER_ID,
      }),
    ).toBeNull();
  });

  it("grants comment access from a comment ACL to a member", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [{ permission: "comment", userId: USER_ID }],
        teamRole: "member",
        userId: USER_ID,
      }),
    ).toBe("comment");
  });

  it("lets a workspace viewer comment when granted a comment ACL", () => {
    expect(
      resolveCollaborationAccess({
        permissions: [{ permission: "comment", userId: USER_ID }],
        teamRole: "viewer",
        userId: USER_ID,
      }),
    ).toBe("comment");
  });
});

describe("resolveEffectiveAccess", () => {
  it("returns the least-privileged of the two access levels", () => {
    expect(resolveEffectiveAccess("write", "write")).toBe("write");
    expect(resolveEffectiveAccess("comment", "write")).toBe("comment");
    expect(resolveEffectiveAccess("write", "comment")).toBe("comment");
    expect(resolveEffectiveAccess("read", "comment")).toBe("read");
    expect(resolveEffectiveAccess("comment", "read")).toBe("read");
    expect(resolveEffectiveAccess("read", "write")).toBe("read");
    expect(resolveEffectiveAccess("comment", "comment")).toBe("comment");
  });

  it("only maps to a read-only connection when the effective access is read", () => {
    // Mirrors the hocuspocus rule: connectionConfig.readOnly = access === "read".
    expect(resolveEffectiveAccess("comment", "write") === "read").toBe(false);
    expect(resolveEffectiveAccess("read", "write") === "read").toBe(true);
  });
});
