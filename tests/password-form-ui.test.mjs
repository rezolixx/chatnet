import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { elements, passwordForm } from "./helpers/password-form.mjs";

const byType = (tree, type) => elements(tree, (element) => element.type === type);
const toggle = (tree) => byType(tree, "button").find((button) => button.props.type === "button");
const passwords = (tree) => byType(tree, "input").filter((input) => input.props.type === "password");

function openAndFill(harness, confirmation = "Password!123") {
  toggle(harness.render()).props.onClick();
  const inputs = passwords(harness.render());
  inputs[0].props.onChange({ target: { value: "Password!123" } });
  inputs[1].props.onChange({ target: { value: confirmation } });
  return byType(harness.render(), "form")[0];
}

test("password form is collapsed on every fresh mount with no fields or automatic request", () => {
  for (let load = 0; load < 2; load++) {
    const tree = passwordForm().render();
    assert.equal(toggle(tree).props["aria-expanded"], false);
    assert.equal(toggle(tree).props.children, "Modifier le mot de passe");
    assert.equal(byType(tree, "form").length, 0);
    assert.equal(passwords(tree).length, 0);
    assert.equal(byType(tree, "button").length, 1);
    const html = renderToStaticMarkup(tree);
    assert.doesNotMatch(html, /<input|<form/);
    assert.match(html, /aria-expanded="false"/);
  }
});

test("compact action toggles the form open and closed and keeps the responsive field grid", () => {
  const harness = passwordForm();
  toggle(harness.render()).props.onClick();
  const opened = harness.render();
  assert.equal(toggle(opened).props["aria-expanded"], true);
  assert.equal(toggle(opened).props.children, "Fermer");
  assert.equal(toggle(opened).props["aria-controls"], byType(opened, "form")[0].props.id);
  assert.equal(passwords(opened).length, 2);
  assert.equal(elements(opened, (element) => element.props?.className === "profile-edit-grid").length, 1);
  toggle(opened).props.onClick();
  assert.equal(toggle(harness.render()).props["aria-expanded"], false);
  assert.equal(passwords(harness.render()).length, 0);
  toggle(harness.render()).props.onClick();
  assert.equal(passwords(harness.render()).length, 2);
});

test("confirmed password success collapses the form, clears both fields and preserves success/session handling", async () => {
  for (const session of ["active", "unverified", "expired"]) {
    const calls = [];
    let complete;
    const harness = passwordForm((url, init) => {
      calls.push({ url, ...init });
      return new Promise((resolve) => { complete = resolve; });
    });
    const submit = openAndFill(harness).props.onSubmit({ preventDefault() {} });
    assert.equal(toggle(harness.render()).props.disabled, true);
    assert.equal(byType(harness.render(), "form")[0].props["aria-busy"], true);
    complete(new Response(JSON.stringify({ changed: true, session })));
    await submit;
    const closed = harness.render();
    assert.equal(toggle(closed).props["aria-expanded"], false);
    assert.equal(passwords(closed).length, 0);
    assert.equal(toggle(closed).props.disabled, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/auth/password");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(JSON.parse(calls[0].body), { new_password: "Password!123" });
    if (session === "expired") assert.deepEqual(harness.navigations, ["/profil/securite/confirme"]);
    else assert.equal(elements(closed, (element) => element.props?.role === "status").length, 1);
    toggle(closed).props.onClick();
    assert.deepEqual(passwords(harness.render()).map((input) => input.props.value), ["", ""]);
  }
});

test("confirmation mismatch keeps the form open and never submits", async () => {
  const harness = passwordForm();
  await openAndFill(harness, "Different!123").props.onSubmit({ preventDefault() {} });
  const tree = harness.render();
  assert.equal(toggle(tree).props["aria-expanded"], true);
  assert.match(elements(tree, (element) => element.props?.role === "alert")[0].props.children, /confirmation/);
});

test("validation or unconfirmed upstream failure keeps the form open with existing error handling", async () => {
  for (const response of [new Response("{}", { status: 422 }), new Response("{}", { status: 503 }), new Response(JSON.stringify({ changed: false }))]) {
    const harness = passwordForm(async () => response);
    await openAndFill(harness).props.onSubmit({ preventDefault() {} });
    const tree = harness.render();
    assert.equal(toggle(tree).props["aria-expanded"], true);
    assert.equal(elements(tree, (element) => element.props?.role === "alert").length, 1);
    assert.deepEqual(passwords(tree).map((input) => input.props.value), ["", ""]);
  }
});
