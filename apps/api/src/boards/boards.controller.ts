import { Controller, Get } from "@nestjs/common";
import { BoardsService } from "./boards.service.js";

@Controller()
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get("/boards")
  async listBoards() {
    return await this.boards.listBoards();
  }
}

