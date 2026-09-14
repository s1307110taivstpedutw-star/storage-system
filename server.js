const app = require("./server/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Storage System server running on port ${PORT}`
  );
});
