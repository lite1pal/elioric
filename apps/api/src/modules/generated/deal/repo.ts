import type { CreateDealInput, DealRecord, ListDealsInput, ListDealsResponse, UpdateDealInput } from "@auditrail/domain/generated/deal";
export interface DealRepo {
  archive(input: { id: string; organizationId: string }): Promise<DealRecord | undefined>;
  create(input: { organizationId: string; data: CreateDealInput }): Promise<DealRecord>;
  findById(input: { id: string; organizationId: string }): Promise<DealRecord | undefined>;
  list(input: { organizationId: string; filters: ListDealsInput }): Promise<ListDealsResponse>;
  unarchive(input: { id: string; organizationId: string }): Promise<DealRecord | undefined>;
  update(input: { id: string; organizationId: string; data: UpdateDealInput }): Promise<DealRecord | undefined>;
}
