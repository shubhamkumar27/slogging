import { describe, it, expect } from "vitest";
import { resolveUser } from "../src/auth.js";

describe("resolveUser", () => {
  const usersJson = '{"shubham":"pin1","friend":"pin2"}';

  it("returns username when passcode matches", () => {
    expect(resolveUser("pin1", usersJson)).toBe("shubham");
    expect(resolveUser("pin2", usersJson)).toBe("friend");
  });

  it("returns null when passcode is wrong or missing", () => {
    expect(resolveUser("nope", usersJson)).toBe(null);
    expect(resolveUser("", usersJson)).toBe(null);
    expect(resolveUser(undefined, usersJson)).toBe(null);
  });

  it("throws if USERS_JSON is malformed", () => {
    expect(() => resolveUser("pin1", "{not json")).toThrow();
  });
});
