import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({
  imports: [DbModule],
  controllers: [SearchController],
  providers: [SearchService]
})
export class SearchModule {}

