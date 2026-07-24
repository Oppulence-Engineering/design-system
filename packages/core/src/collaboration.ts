import { z } from "zod";

export const COLLABORATION_TICKET_AUDIENCE = "canvas-collaboration";
export const COLLABORATION_TICKET_ISSUER = "canvas-api";
export const COLLABORATION_TICKET_TTL_SECONDS = 5 * 60;

export const CollaborationAccessSchema = z.enum(["read", "comment", "write"]);

export const CollaborationTicketClaimsSchema = z.object({
  access: CollaborationAccessSchema,
  documentId: z.string().uuid(),
  documentName: z.string().min(1),
  exp: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  roomName: z.string().min(1),
  sub: z.string().uuid(),
  teamId: z.string().uuid(),
});

export type CollaborationAccess = z.infer<typeof CollaborationAccessSchema>;
export type CollaborationTicketClaims = z.infer<
  typeof CollaborationTicketClaimsSchema
>;

type CollaborationPermission = "admin" | "comment" | "edit" | "view";
type CollaborationTeamRole = "member" | "owner" | "viewer";

export interface CollaborationPermissionEntry {
  permission: CollaborationPermission;
  userId: string | null;
}

const permissionToAccess = (
  permission: CollaborationPermission,
): CollaborationAccess => {
  if (permission === "admin" || permission === "edit") {
    return "write";
  }
  if (permission === "comment") {
    return "comment";
  }
  return "read";
};

/**
 * Combine two access levels into the least-privileged of the two, under the
 * ordering read < comment < write. Used to reconcile the access granted by a
 * (possibly stale) collaboration ticket with the user's freshly-resolved access,
 * so a ticket can never grant more than the user currently holds.
 *
 * @param a - First access level.
 * @param b - Second access level.
 * @returns The lower-privilege of the two.
 */
export const resolveEffectiveAccess = (
  a: CollaborationAccess,
  b: CollaborationAccess,
): CollaborationAccess => {
  const rank: Record<CollaborationAccess, number> = {
    read: 0,
    comment: 1,
    write: 2,
  };
  return rank[a] <= rank[b] ? a : b;
};

export const resolveCollaborationAccess = ({
  permissions,
  teamRole,
  userId,
}: {
  permissions: CollaborationPermissionEntry[];
  teamRole: CollaborationTeamRole | null;
  userId: string;
}): CollaborationAccess | null => {
  if (teamRole === "owner") {
    return "write";
  }

  if (!(teamRole === "member" || teamRole === "viewer")) {
    return null;
  }

  const userPermission = permissions.find(
    (permission) => permission.userId === userId,
  );
  const teamPermission = permissions.find(
    (permission) => permission.userId === null,
  );
  const explicitPermission = userPermission ?? teamPermission;

  if (!explicitPermission && permissions.length > 0) {
    return null;
  }

  const permittedAccess = explicitPermission
    ? permissionToAccess(explicitPermission.permission)
    : teamRole === "member"
      ? "write"
      : "read";

  // Workspace viewers may be granted comment (or read) access on a document but
  // are never elevated to write, even by an explicit edit/admin document ACL.
  if (teamRole === "viewer") {
    return permittedAccess === "write" ? "read" : permittedAccess;
  }
  return permittedAccess;
};
