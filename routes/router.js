const router = require("express").Router();
const multer = require("multer");
const upload = multer();

const workerController = require("../controller/workerController");
const workerValidation = require("../validation/WorkerValidation");

const tableController = require("../controller/tableController");
const tableValidation = require("../validation/TableValidation");
const foodController = require("../controller/foodController");
const foodValidation = require("../validation/FoodValidation");
const orderController = require("../controller/OrderController"); // Yangi kontroller

// Worker routes
router.get("/workers/all", workerController.getWorkers);
router.get("/workers/:id", workerController.getWorkerById);
router.post("/workers/create", workerValidation, workerController.createWorker);
router.post("/login", workerController.login);
router.delete("/workers/delete/:id", workerController.deleteWorker);
router.put("/workers/update/:id", workerController.updateWorker);
router.put("/workers/status/:id", workerController.changeStatus);

// Table routes
router.get("/tables/all", tableController.getTables);
router.get("/tables/:id", tableController.getTableById);
router.post("/tables/create", tableValidation, tableController.createTable);
router.delete("/tables/delete/:id", tableController.deleteTable);
router.put("/tables/update/:id", tableController.updateTable);
router.put("/tables/status/:id", tableController.changeTableStatus);

// Food routes
router.get("/foods/all", foodController.getFoods);
router.get("/foods/:id", foodController.getFoodById);
router.post(
  "/foods/create",
  upload.single("image"),
  [foodValidation],
  foodController.createFood
);
router.delete("/foods/delete/:id", foodController.deleteFood);
router.put("/foods/update/:id", foodController.updateFood);
router.put("/foods/status/:id", foodController.changeStatus);

// Order routes (Yangi)
router.post("/orders/create", orderController.createOrder);
router.put("/orders/close/:id", orderController.closeOrder);
router.get("/orders/table/:tableId", orderController.getOrdersByTable);
router.get("/orders/bill/:tableId", orderController.getBill);

module.exports = router;
