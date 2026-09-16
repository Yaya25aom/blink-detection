import "dotenv/config";
import app from "./app.js";
import { testDatabaseConnection } from "./config/database.js";

const PORT = process.env.PORT || 3000;

testDatabaseConnection();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});