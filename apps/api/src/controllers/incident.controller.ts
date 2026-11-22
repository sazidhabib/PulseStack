import { Request, Response, NextFunction } from 'express';
import { IncidentService } from '../services/incident.service';

export class IncidentController {
  constructor(private incidentService: IncidentService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as 'open' | 'resolved' | undefined;

      const result = await this.incidentService.listIncidents(req.scope!, {
        page,
        limit,
        status,
      });

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
      const incident = await this.incidentService.getIncidentById(req.scope!, id);

      res.json({
        success: true,
        data: incident,
      });
    } catch (err) {
      next(err);
    }
  };
}
