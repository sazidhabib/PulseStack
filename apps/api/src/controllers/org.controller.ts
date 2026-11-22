import { Request, Response, NextFunction } from 'express';
import { OrgService } from '../services/org.service';

export class OrgController {
  constructor(private orgService: OrgService) {}

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await this.orgService.getOrg(req.scope!);
      res.json({
        success: true,
        data: org,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await this.orgService.updateOrg(req.scope!, req.body);
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };
}
