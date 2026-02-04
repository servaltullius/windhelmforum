import { Injectable } from "@nestjs/common";
import { Client, Connection } from "@temporalio/client";

@Injectable()
export class TemporalService {
  private clientPromise: Promise<Client> | null = null;

  get client(): Promise<Client> {
    if (this.clientPromise) {
      return this.clientPromise.catch((error) => {
        this.clientPromise = null;
        throw error;
      });
    }

    this.clientPromise = (async () => {
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
      const connection = await Connection.connect({ address });
      return new Client({ connection, namespace });
    })();

    return this.clientPromise.catch((error) => {
      this.clientPromise = null;
      throw error;
    });
  }
}
