import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { AVATAR_MAX_BYTES, avatarValidationError, projectUploadedAvatar } from "../src/lib/auth/avatar.ts";

const root = new URL("../src/", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("avatar selection follows Laravel's formats and 4 MiB limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
    assert.equal(avatarValidationError({ type, size: AVATAR_MAX_BYTES }), null);
  }
  assert.match(avatarValidationError({ type: "image/svg+xml", size: 100 }), /JPEG/);
  assert.match(avatarValidationError({ type: "image/png", size: AVATAR_MAX_BYTES + 1 }), /4 Mo/);
  assert.ok(avatarValidationError({ type: "image/png", size: 0 }));
});

test("avatar upload response projects only a safe public URL", () => {
  assert.equal(projectUploadedAvatar({ avatar: "https://laravel.discut.org/storage/uploads/avatars/new.webp", avatar_path: "private/path", email: "secret@example.com" }), "https://laravel.discut.org/storage/uploads/avatars/new.webp");
  assert.equal(projectUploadedAvatar({ avatar: "javascript:alert(1)" }), null);
  assert.equal(projectUploadedAvatar({ avatar: "uploads/avatars/new.webp" }), null);
  assert.equal(projectUploadedAvatar({ avatar: "https://example.com/", extra: "secret" }), "https://example.com/");
});

test("avatar BFF requires trusted origin and session before forwarding one multipart avatar", () => {
  const route = source("app/api/auth/avatar/route.ts");
  assert.match(route, /hasTrustedOrigin\(request\)/);
  assert.match(route, /readBridgeCookies\(request\)/);
  assert.match(route, /if \(!cookies\) return unauthenticated\(\)/);
  assert.match(route, /clearBridgeCookies\(response\)/);
  assert.match(route, /await laravelMe\(cookies\)/);
  assert.ok(route.indexOf("await laravelMe(cookies)") < route.indexOf("await readAvatar(request)"));
  assert.match(route, /AVATAR_MAX_REQUEST_BYTES/);
  assert.match(route, /form\.getAll\("avatar"\)\.length !== 1/);
  assert.match(route, /body\.set\("avatar", avatar!\)/);
  assert.match(route, /csrfCookies\(verified\.cookies\)/);
  assert.match(route, /"X-XSRF-TOKEN": xsrf/);
  assert.match(route, /fetchLaravel\("\/api\/upload-avatar"/);
  assert.match(route, /projectUploadedAvatar\(await upstream\.json\(\)\)/);
  assert.match(route, /NextResponse\.json\(\{ avatar: avatarUrl \}/);
  assert.doesNotMatch(route, /NextResponse\.json\(await upstream\.json\(\)/);
  assert.doesNotMatch(route, /localStorage|sessionStorage/);
});

test("profile and navbar refresh the changed avatar, with Description absent from the UI", () => {
  const editor = source("components/auth/AvatarEditor.tsx");
  const provider = source("components/auth/AuthProvider.tsx");
  const avatar = source("components/community/MemberAvatar.tsx");
  const profile = source("components/auth/ProfileContent.tsx");
  const navbar = source("components/layout/Navbar.tsx");
  assert.match(editor, /Changer la photo/);
  assert.match(editor, /preview \?\? avatar/);
  assert.match(editor, /onUploaded\(result\.avatar\)/);
  assert.match(editor, /updateAvatar\(nickname, result\.avatar\)/);
  assert.match(editor, /void refreshUser\(\)/);
  assert.match(provider, /setUser\(\(current\) => current\?\.nickname === nickname \? \{ \.\.\.current, avatar \} : current\)/);
  assert.match(navbar, /<MemberAvatar member=\{user\}/);
  assert.match(avatar, /member\.avatar !== failedAvatar/);
  assert.match(profile, /<AvatarEditor/);
  assert.doesNotMatch(profile, /profile\.description|<h3>Description<\/h3>|profile-description/);
});
