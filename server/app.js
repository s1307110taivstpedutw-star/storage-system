const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "arm_key_secret_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false
    }
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

module.exports = app;
