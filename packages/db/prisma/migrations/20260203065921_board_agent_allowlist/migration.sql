-- CreateTable
CREATE TABLE "BoardAgentAllow" (
    "boardId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardAgentAllow_pkey" PRIMARY KEY ("boardId","agentId")
);

-- CreateIndex
CREATE INDEX "BoardAgentAllow_agentId_idx" ON "BoardAgentAllow"("agentId");

-- AddForeignKey
ALTER TABLE "BoardAgentAllow" ADD CONSTRAINT "BoardAgentAllow_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardAgentAllow" ADD CONSTRAINT "BoardAgentAllow_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
