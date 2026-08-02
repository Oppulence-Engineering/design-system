/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listOrganizationMemberships = vi.fn();

vi.mock("@workos-inc/node", () => ({
  WorkOS: class {
    userManagement = {
      listOrganizationMemberships: (...args: unknown[]) =>
        listOrganizationMemberships(...args),
    };
  },
}));

const { getOrganizationMembership } = await import("./client");

/** One membership row as WorkOS returns it, with a settable role. */
function workosMembership(role?: { slug: string }) {
  return {
    id: "mem_1",
    userId: "user_1",
    organizationId: "org_1",
    role,
    createdAt: new Date().toISOString(),
  };
}

describe("getOrganizationMembership", () => {
  beforeEach(() => {
    listOrganizationMemberships.mockReset();
  });

  it("maps the role WorkOS reports", async () => {
    listOrganizationMemberships.mockResolvedValue({
      data: [workosMembership({ slug: "admin" })],
    });

    const membership = await getOrganizationMembership("user_1", "org_1");

    expect(membership.role).toBe("admin");
    expect(membership.id).toBe("mem_1");
  });

  /*
   * A membership arriving without a role slug is missing data. Defaulting it
   * to "member" handed out the level requireRole("member") and
   * roleMiddleware("member") accept; "guest" is the bottom of the hierarchy.
   */
  it("falls back to the least privilege when no role is reported", async () => {
    listOrganizationMemberships.mockResolvedValue({
      data: [workosMembership()],
    });

    expect((await getOrganizationMembership("user_1", "org_1")).role).toBe(
      "guest",
    );
  });

  it("falls back when the role carries no slug", async () => {
    listOrganizationMemberships.mockResolvedValue({
      data: [workosMembership({} as { slug: string })],
    });

    expect((await getOrganizationMembership("user_1", "org_1")).role).toBe(
      "guest",
    );
  });

  it("throws when the user is not a member", async () => {
    listOrganizationMemberships.mockResolvedValue({ data: [] });

    await expect(
      getOrganizationMembership("user_1", "org_1"),
    ).rejects.toMatchObject({ code: "ORGANIZATION_MEMBERSHIP_NOT_FOUND" });
  });

  // Documented as always empty; this pins it so the docs cannot quietly
  // become wrong if a mapping is added without updating them.
  it("reports no permissions", async () => {
    listOrganizationMemberships.mockResolvedValue({
      data: [workosMembership({ slug: "owner" })],
    });

    expect(
      (await getOrganizationMembership("user_1", "org_1")).permissions,
    ).toEqual([]);
  });
});
