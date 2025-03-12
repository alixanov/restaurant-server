const response = require("../utils/response");
const OrderModel = require("../model/OrderModel");
const TableModel = require("../model/tableModel");
const DishModel = require("../model/FoodModel"); // FoodModel o'rniga DishModel to'g'rilandi
const WorkerModel = require("../model/workersModel"); // WorkerModel qo‘shildi

// ESC/POS kutubxonalarini import qilish
const escpos = require("escpos");
escpos.Network = require("escpos-network");
// 
class OrderController {
  constructor() {
    this.PRINTERS = {
      food: {
        ip: process.env.PRINTER_FOOD_IP,
        port: process.env.PRINTER_FOOD_PORT,
      },
      shashlik: {
        ip: process.env.PRINTER_SHASHLIK_IP,
        port: process.env.PRINTER_SHASHLIK_PORT,
      },
      salat: {
        ip: process.env.PRINTER_SALAT_IP,
        port: process.env.PRINTER_SALAT_PORT,
      },
      drink: {
        ip: process.env.PRINTER_DRINK_IP,
        port: process.env.PRINTER_DRINK_PORT,
      },
      desert: {
        ip: process.env.PRINTER_DESERT_IP,
        port: process.env.PRINTER_DESERT_PORT,
      },
      other: {
        ip: process.env.PRINTER_OTHER_IP,
        port: process.env.PRINTER_OTHER_PORT,
      },
    };
  }

  isShashlik(dishName) {
    const shashlikKeywords = ["shashlik", "kabob", "kebab"];
    return shashlikKeywords.some((keyword) =>
      dishName.toLowerCase().includes(keyword)
    );
  }

  // Printerga ulanish va chop etish
  printOrderToPrinter = async (order, table, dishDetails, category) => {
    try {
      const printerConfig = this.PRINTERS[category];
      if (!printerConfig || !printerConfig.ip) {
        throw new Error(`Kategoriya uchun printer sozlanmagan: ${category}`);
      }

      const device = new escpos.Network(printerConfig.ip, printerConfig.port);
      const printer = new escpos.Printer(device);

      const connectWithRetry = (maxRetries = 3, retryDelay = 2000) => {
        return new Promise((resolve, reject) => {
          let retries = 0;

          const attemptConnect = () => {
            device.open((error) => {
              if (!error) {
                resolve();
              } else {
                retries++;
                if (retries < maxRetries) {
                  console.warn(
                    `Printerga ulanishda xato (${retries}/${maxRetries})...`
                  );
                  setTimeout(attemptConnect, retryDelay);
                } else {
                  reject(
                    new Error(`Printerga ulanib bo‘lmadi: ${error.message}`)
                  );
                }
              }
            });
          };

          attemptConnect();
        });
      };

      await connectWithRetry();

      // Ofitsiant ismini olish
      const worker = await WorkerModel.findById(order.worker);
      if (!worker) {
        throw new Error("Ofitsiant topilmadi");
      }

      printer
        .font("a")
        .align("ct")
        .style("bu")
        .size(1, 1)
        .text("Buyurtma")
        .text("---------------")
        .align("lt")
        .text(`Stol raqami: ${table.number}`) // Stol raqami
        .text(`Ofitsiant: ${worker.fullname}`) // Ofitsiant ismi
        .text("Taomlar:")
  

      dishDetails.forEach((item) => {
        let unit = item.category === "drink" ? "litr" : "dona";
        printer.text(`${item.quantity}x ${item.name} (${unit})`); // Taom nomi va soni
      });

      printer
        .text("---------------")
        .align("ct")
        .cut()
        .close();
    } catch (err) {
      console.error(`Chop etishda xato (${category}):`, err.message);
      throw new Error(`Printer bilan muammo (${category}): ${err.message}`);
    }
  };

  // Yangi buyurtma yaratish
  createOrder = async (req, res) => {
    try {
      let io = req.app.get("socket");
      if (!io) return response.serverError(res, "Socket.io yo'q");

      const { tableId, foods, workerId } = req.body;

      let table = await TableModel.findById(tableId);
      if (!table) return response.notFound(res, "Stol topilmadi");

      let totalPrice = 0;
      const dishDetails = [];
      for (let item of foods) {
        let dish = await DishModel.findById(item.food);
        if (!dish) return response.notFound(res, "Taom topilmadi");
        totalPrice += dish.price * item.quantity;
        dishDetails.push({
          name: dish.name,
          quantity: item.quantity,
          price: dish.price,
          category: dish.category,
        });
      }

      const order = await OrderModel.create({
        table: tableId,
        worker: workerId,
        foods,
        totalPrice,
      });

      const categorizedDishes = {};
      dishDetails.forEach((item) => {
        let printCategory = item.category;
        if (item.category === "food" && this.isShashlik(item.name)) {
          printCategory = "shashlik";
        }
        if (!categorizedDishes[printCategory]) {
          categorizedDishes[printCategory] = [];
        }
        categorizedDishes[printCategory].push(item);
      });

      for (const category in categorizedDishes) {
        await this.printOrderToPrinter(
          order,
          table,
          categorizedDishes[category],
          category
        );
      }

      io.emit("new_order", order);
      io.emit("table_status", { tableId, isActive: true });

      response.created(res, "Buyurtma yaratildi", order);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  };

  // Quyidagi funksiyalarni o‘zgartirmaymiz, chunki ularni keyinroq qilamiz
  closeOrder = async (req, res) => {
    try {
      let io = req.app.get("socket");
      if (!io) return response.serverError(res, "Socket.io yo'q");

      const orderId = req.params.id;

      let order = await OrderModel.findById(orderId).populate("table");
      if (!order) return response.notFound(res, "Buyurtma topilmadi");
      if (order.status !== "open")
        return response.error(
          res,
          "Buyurtma allaqachon yopilgan yoki bekor qilingan"
        );

      order.status = "closed";
      await order.save();

      io.emit("order_closed", order);

      response.success(res, "Buyurtma yopildi", order);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  };

  getOrdersByTable = async (req, res) => {
    try {
      const tableId = req.params.tableId;
      const orders = await OrderModel.find({ table: tableId, status: "open" })
        .populate("table")
        .populate("worker")
        .populate("foods.food");
      if (!orders.length)
        return response.notFound(
          res,
          "Ushbu stol uchun ochiq buyurtmalar topilmadi"
        );
      response.success(res, "Buyurtmalar topildi", orders);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  };

  getBill = async (req, res) => {
    try {
      let io = req.app.get("socket");
      if (!io) return response.serverError(res, "Socket.io yo'q");

      const tableId = req.params.tableId;

      const orders = await OrderModel.find({
        table: tableId,
        status: "open",
      }).populate("foods.food");

      if (!orders.length)
        return response.notFound(res, "Ochiq buyurtmalar topilmadi");

      let totalBill = 0;
      orders.forEach((order) => {
        totalBill += order.totalPrice;
      });

      await OrderModel.updateMany(
        { table: tableId, status: "open" },
        { status: "closed" }
      );

      let table = await TableModel.findById(tableId);
      table.isActive = false;
      await table.save();

      io.emit("table_status", { tableId, isActive: false });
      io.emit("bill_generated", { tableId, totalBill, orders });

      response.success(res, "Hisob tayyor", {
        tableId,
        totalBill,
        orders,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  };
}

module.exports = new OrderController();
