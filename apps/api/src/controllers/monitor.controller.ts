import { Request, Response, NextFunction } from 'express';
import { MonitorService } from '../services/monitor.service';

export class MonitorController {
  constructor(private monitorService: MonitorService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.monitorService.listMonitors(req.scope!, req.query as any);
      res.json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const monitor = await this.monitorService.getMonitorById(req.scope!, id);
      res.json({
        success: true,
        data: monitor,
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await this.monitorService.createMonitor(req.scope!, req.body);
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const updated = await this.monitorService.updateMonitor(req.scope!, id, req.body);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const deleted = await this.monitorService.deleteMonitor(req.scope!, id);
      res.json({
        success: true,
        data: { id: deleted.id, message: 'Monitor deleted successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  pause = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const paused = await this.monitorService.pauseMonitor(req.scope!, id);
      res.json({
        success: true,
        data: paused,
      });
    } catch (err) {
      next(err);
    }
  };

  resume = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const resumed = await this.monitorService.resumeMonitor(req.scope!, id);
      res.json({
        success: true,
        data: resumed,
      });
    } catch (err) {
      next(err);
    }
  };

  getResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await this.monitorService.getMonitorResults(
        req.scope!,
        id,
        page,
        limit
      );

      res.json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const stats = await this.monitorService.getMonitorStats(req.scope!, id);
      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  };
}
