import { IsInt, IsPositive, Min } from 'class-validator';

export class PurchaseCreditsDto {
  @IsInt()
  @IsPositive()
  @Min(1)
  amount: number;
}
