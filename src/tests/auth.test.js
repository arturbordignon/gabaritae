const chai = require("chai");
const chaiHttp = require("chai-http");
const app = require("../src/app");
const expect = chai.expect;

chai.use(chaiHttp);

describe("Authentication API", () => {
  it("should register a user successfully", (done) => {
    chai
      .request(app)
      .post("/api/register")
      .send({
        completeName: "Test User",
        email: "testuser@example.com",
        password: "Test1234",
        category: "ENEM",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("token");
        done();
      });
  });

  it("should login a user successfully", (done) => {
    chai
      .request(app)
      .post("/api/login")
      .send({
        email: "testuser@example.com",
        password: "Test1234",
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property("token");
        done();
      });
  });
});
