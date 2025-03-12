const response = require("../utils/response");
const tableModel = require("../model/tableModel");

class TableController {
  async getTables(req, res) {
    try {
      const tables = await tableModel.find();
      if (!tables.length) return response.notFound(res, "Stollar topilmadi");
      response.success(res, "Stol topildi", tables);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async getTableById(req, res) {
    try {
      const table = await tableModel.findById(req.params.id);
      if (!table) return response.notFound(res, "Stol topilmadi");
      response.success(res, "Stol topildi", table);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async createTable(req, res) {
    try {
      let io = req.app.get("socket");
      const table = await tableModel.create(req.body);
      if (!table) return response.error(res, "Stol qo'shilmadi");
      response.created(res, "Stol qo'shildi", table);
      io.emit("table", table);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async updateTable(req, res) {
    try {
      let io = req.app.get("socket");
      const table = await tableModel.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!table) return response.error(res, "Stol yangilashda xatolik");
      response.success(res, "Stol yangilandi", table);
      io.emit("table", table);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async deleteTable(req, res) {
    try {
      let io = req.app.get("socket");
      const table = await tableModel.findByIdAndDelete(req.params.id);
      if (!table) return response.error(res, "Stol o'chirilmadi");
      response.success(res, "Stol o'chirildi");
      io.emit("table", table);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async changeTableStatus(req, res) {
    try {
      let io = req.app.get(" socket ");
      let table = await tableModel.findById(req.params.id);
      table.isActive = !table.isActive;
      let result = await table.save();
      if (!result) return response.error(res, "Status o'zgarmadi");
      response.success(
        res,
        `Stol ${table.isActive ? "aktiv" : "band"} qilindi`,
        table
      );
      io.emit("table", table);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }
}

module.exports = new TableController();
