"use client";

import { SoftDeleteButton } from "@/components/admin/SoftDeleteButton";
import {
  restoreInvoice,
  restoreOrder,
  restoreRegisteredCustomer,
  restoreWalkInCustomer,
  softDeleteInvoice,
  softDeleteOrder,
  softDeleteRegisteredCustomer,
  softDeleteWalkInCustomer,
} from "@/app/(admin)/admin/data/actions";

export function OrderArchiveControls({
  orderId,
  archived,
}: {
  orderId: string;
  archived: boolean;
}) {
  if (archived) {
    return (
      <SoftDeleteButton
        mode="restore"
        confirmTitle="Restore this order from Trash?"
        askReason={false}
        onConfirm={() => restoreOrder(orderId)}
      />
    );
  }
  return (
    <SoftDeleteButton
      mode="archive"
      confirmTitle="Reason for archiving this order (saved in Trash):"
      defaultReason="Mistake / test order"
      onConfirm={(reason) => softDeleteOrder(orderId, reason)}
    />
  );
}

export function InvoiceArchiveControls({
  invoiceId,
  archived,
}: {
  invoiceId: string;
  archived: boolean;
}) {
  if (archived) {
    return (
      <SoftDeleteButton
        mode="restore"
        confirmTitle="Restore this invoice from Trash?"
        askReason={false}
        onConfirm={() => restoreInvoice(invoiceId)}
      />
    );
  }
  return (
    <SoftDeleteButton
      mode="archive"
      confirmTitle="Reason for archiving this invoice (also cancels if still issued):"
      defaultReason="Mistake / test invoice"
      onConfirm={(reason) => softDeleteInvoice(invoiceId, reason)}
    />
  );
}

export function CustomerArchiveControls({
  profileId,
  archived,
}: {
  profileId: string;
  archived: boolean;
}) {
  if (archived) {
    return (
      <SoftDeleteButton
        mode="restore"
        confirmTitle="Restore this customer from Trash?"
        askReason={false}
        onConfirm={() => restoreRegisteredCustomer(profileId)}
      />
    );
  }
  return (
    <SoftDeleteButton
      mode="archive"
      confirmTitle="Reason for archiving this customer:"
      defaultReason="Mistake / test customer"
      onConfirm={(reason) => softDeleteRegisteredCustomer(profileId, reason)}
    />
  );
}

export function WalkInArchiveControls({
  phoneKey,
  archived,
}: {
  phoneKey: string;
  archived: boolean;
}) {
  if (archived) {
    return (
      <SoftDeleteButton
        mode="restore"
        confirmTitle="Restore this walk-in customer from Trash?"
        askReason={false}
        onConfirm={() => restoreWalkInCustomer(phoneKey)}
      />
    );
  }
  return (
    <SoftDeleteButton
      mode="archive"
      label="Archive walk-in"
      confirmTitle="Archive this walk-in and their guest orders to Trash?"
      defaultReason="Mistake / test walk-in"
      onConfirm={(reason) => softDeleteWalkInCustomer(phoneKey, reason)}
    />
  );
}
