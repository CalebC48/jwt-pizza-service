const request = require("supertest");
const app = require("../../service");
const { authRouter, setAuthUser } = require("../../routes/authRouter.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimout(500000);
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);
});

test("register", async () => {
  const user = { name: "pizza diner", email: "reg@test.com", password: "a" };
  user.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const regRes = await request(app).post("/api/auth").send(user);
  expect(regRes.status).toBe(200);
});

test("register w/o password", async () => {
  const user = { name: "pizza diner", email: "reg@test.com" };
  user.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const regRes = await request(app).post("/api/auth").send(user);
  expect(regRes.status).toBe(400);
});

test("login", async () => {
  1;
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

//Multi login test?

test("setAuthUser()", async () => {
  req = { headers: { authorization: `Bearer ${testUserAuthToken}` } };
  res = {};
  next = jest.fn();
  await setAuthUser(req, res, next);

  expect(req.user.email).toBe(testUser.email);
  expect(next).toHaveBeenCalled();
});

test("setAuthUser() with bad token", async () => {
  req = { headers: { authorization: `Bearer ${testUserAuthToken}bad` } };
  res = {};
  next = jest.fn();
  await setAuthUser(req, res, next);

  expect(req.user).toBeUndefined();
  expect(next).toHaveBeenCalled();
});

test("logout", async () => {
  await request(app).put("/api/auth").send(testUser);
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
});

// test("update user", async () => {
//   const updatedUser = {
//     name: "Updated Name",
//     email: "updated@test.com",
//     password: "a",
//   };

//   console.log("testUserId", testUserId);

//   const updateRes = await request(app)
//     .put(`/api/auth/${testUserId}`)
//     .set("Authorization", `Bearer ${testUserAuthToken}`)
//     .send(updatedUser);

//   expect(updateRes.status).toBe(200);
//   expect(updateRes.body.user.name).toBe(updatedUser.name);
//   expect(updateRes.body.user.email).toBe(updatedUser.email);
// });

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
