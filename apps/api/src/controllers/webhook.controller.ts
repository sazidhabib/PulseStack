import { Request, Response, NextFunction } from 'express';
import { WebhookService } from '../services/webhook.service';

export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhooks = await this.webhookService.listWebhooks(req.scope!);
      res.json({
        success: true,
        data: webhooks,
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const webhook = await this.webhookService.getWebhookById(req.scope!, id);
      res.json({
        success: true,
        data: webhook,
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await this.webhookService.createWebhook(req.scope!, req.body);
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
      const updated = await this.webhookService.updateWebhook(req.scope!, id, req.body);
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
      const deleted = await this.webhookService.deleteWebhook(req.scope!, id);
      res.json({
        success: true,
        data: { id: deleted.id, message: 'Webhook deleted successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  getDeliveries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const deliveries = await this.webhookService.getDeliveries(req.scope!, id, limit);
      res.json({
        success: true,
        data: deliveries,
      });
    } catch (err) {
      next(err);
    }
  };

  test = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await this.webhookService.sendTestDelivery(req.scope!, id);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
