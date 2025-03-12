const response = require("../utils/response");
const workersDB = require("../model/workersModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

class WorkerController {
  async getWorkers(req, res) {
    try {
      const workers = await workersDB.find();
      if (!workers.length) return response.notFound(res, "ishchilar topilmadi");
      response.success(res, "Barcha ishchilar", workers);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  // get by id
  async getWorkerById(req, res) {
    try {
      const worker = await workersDB.findById(req.params.id);
      if (!worker) return response.notFound(res, "Ishchi topilmadi");
      response.success(res, "Ishchi topildi", worker);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async createWorker(req, res) {
    try {
      let io = req.app.get("socket");
      let data = req.body;

      let exactWorker = await workersDB.findOne({ login: data.login });
      if (exactWorker) return response.error(res, "Ishchi logini band");

      let exactPhone = await workersDB.findOne({ phone: data.phone });
      if (exactPhone)
        return response.error(res, "Ishchi telefon raqami avvaldan mavjud");

      let genSalt = await bcrypt.genSalt(+process.env.saltRounds);
      const hashedPassword = await bcrypt.hash(data.password, +genSalt);
      data.password = hashedPassword;

      const worker = await workersDB.create(data);
      if (!worker) return response.error(res, "Ishchi qo'shilmadi");
      io.emit("new_worker", worker);
      response.created(res, "Ishchi yaratildi", worker);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async login(req, res) {
    try {
      let { login, password } = req.body;
      let exactWorker = await workersDB.findOne({ login });
      if (!exactWorker) return response.error(res, "Login yoki parol xato");

      let isMatchPassword = await bcrypt.compare(
        password,
        exactWorker.password
      );
      if (!isMatchPassword) return response.error(res, "Login yoki parol xato");

      let token = await jwt.sign(
        {
          id: exactWorker._id,
          login: exactWorker.login,
          role: exactWorker.role,
          isActive: exactWorker.isActive,
        },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "1d",
        }
      );
      response.success(res, "Kirish muvaffaqiyatli", {
        worker: { ...exactWorker.toJSON() },
        token,
      });
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async deleteWorker(req, res) {
    try {
      let io = req.app.get("socket");
      const worker = await workersDB.findByIdAndDelete(req.params.id);
      if (!worker) return response.error(res, "Ishchi o'chirilmadi");
      response.success(res, "Ishchi o'chirildi");
      io.emit("new_worker", worker);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async updateWorker(req, res) {
    try {
      let io = req.app.get("socket");
      const { login, password } = req.body;

      const existingWorker = await workersDB.findOne({ login });
      if (existingWorker)
        return response.error(res, "Bu login allaqachon mavjud");

      let genSalt = await bcrypt.genSalt(+process.env.saltRounds);
      const hashedPassword = await bcrypt.hash(password, +genSalt);
      req.body.password = hashedPassword;

      // Yangilash
      const updatedWorker = await workersDB.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!updatedWorker)
        return response.error(res, "Ishchi yangilashda xatolik");

      response.success(res, "Ishchi yangilandi", updatedWorker);
      io.emit("new_worker", updatedWorker);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }

  async changeStatus(req, res) {
    try {
      let io = req.app.get("socket");
      const worker = await workersDB.findById(req.params.id);
      if (!worker) return response.error(res, "Ishchi topilmadi");

      worker.isActive = !worker.isActive;
      await worker.save();

      response.success(
        res,
        `Ishchi statusi ${worker.isActive ? "aktiv" : "noaktiv"} qilindi`,
        worker
      );
      io.emit("worker_status_updated", worker);
    } catch (err) {
      response.serverError(res, err.message, err);
    }
  }
}

module.exports = new WorkerController();
