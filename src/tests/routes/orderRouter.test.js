const request = require("supertest");
const app = require("../../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimout(500000);
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  console.log("beforeAll testUserAuthToken: " + testUserAuthToken);
});

test("Get pizza menu", async () => {
  const menuRes = await request(app).get("/api/order/menu");
  expect(menuRes.status).toBe(200);
  expect(menuRes.body).not.toBeNull();
});

test("Create order", async () => {
  const orderReq = {
    franchiseId: 1,
    storeId: "1",
    items: [
      { menuId: 1, description: "Veggie", price: 0.0038 },
      { menuId: 2, description: "Pepperoni", price: 0.0042 },
    ],
  };
  console.log("create order testUserAuthToken: " + testUserAuthToken);
  const orderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(orderReq);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body.order).not.toBeNull();
  expect(orderRes.body.order.reportSlowPizzaToFactoryUrl).not.toBeNull();
});

test("Get orders", async () => {
  const orderReq = {
    franchiseId: 1,
    storeId: "1",
    items: [
      { menuId: 1, description: "Veggie", price: 0.0038 },
      { menuId: 2, description: "Pepperoni", price: 0.0042 },
    ],
  };
  await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(orderReq);
  const ordersRes = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  console.log("orders: " + JSON.stringify(ordersRes.body));
  expect(ordersRes.status).toBe(200);
  expect(ordersRes.body.orders.orders).not.toBeNull();
  expect(ordersRes.body.orders.length).toBeGreaterThan(0);
});

// function expectValidJwt(potentialJwt) {
//   expect(potentialJwt).toMatch(
//     /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
//   );
// }
