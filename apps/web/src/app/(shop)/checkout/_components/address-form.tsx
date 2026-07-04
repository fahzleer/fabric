"use client";

import { saveShippingAddress, shippingAddressAtom } from "@/application/atoms/checkout.atoms";
import type { ShippingAddressFormData } from "@/application/atoms/checkout.atoms";
import { Atom, useAtom, useAtomSet } from "@effect-atom/atom-react";
import { Button } from "@fabric/ui";
import { Option } from "effect";
import type React from "react";
import { useState } from "react";

const addressFormAtom = Atom.make<ShippingAddressFormData>({
  recipientName: "",
  street: "",
  city: "",
  postalCode: "",
  country: "TH",
  phone: "",
  email: "",
});

const addressErrorsAtom = Atom.make<Partial<Record<keyof ShippingAddressFormData, string>>>({});

interface AddressFormProps {
  onNext: () => void | Promise<void>;
}

export function AddressForm({ onNext }: AddressFormProps) {
  const setShippingAddress = useAtomSet(shippingAddressAtom);
  const [form, setForm] = useAtom(addressFormAtom);
  const [errors, setErrors] = useAtom(addressErrorsAtom);
  const [isPending, setIsPending] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ShippingAddressFormData, string>> = {};
    if (form.recipientName.trim().length < 2) newErrors.recipientName = "กรุณากรอกชื่อผู้รับ";
    if (form.street.trim().length < 5) newErrors.street = "กรุณากรอกที่อยู่";
    if (form.city.trim().length < 2) newErrors.city = "กรุณากรอกเขต/อำเภอ";
    if (form.postalCode.trim().length < 4) newErrors.postalCode = "กรุณากรอกรหัสไปรษณีย์";
    if (form.phone.trim().length < 9) newErrors.phone = "กรุณากรอกเบอร์โทรศัพท์";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      newErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    saveShippingAddress(form);
    setShippingAddress(Option.some(form));
    setIsPending(true);
    try {
      await onNext();
    } finally {
      setIsPending(false);
    }
  };

  const fieldClass = (err?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      err ? "border-destructive" : "border-border-strong"
    }`;

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">ที่อยู่จัดส่ง</h2>

      <div>
        <label
          htmlFor="recipientName"
          className="block text-sm font-medium text-muted-foreground mb-1"
        >
          ชื่อผู้รับ
        </label>
        <input
          id="recipientName"
          type="text"
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          className={fieldClass(errors.recipientName)}
          placeholder="ชื่อ-นามสกุล"
        />
        {errors.recipientName && (
          <p className="mt-1 text-xs text-destructive">{errors.recipientName}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
          อีเมล
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={fieldClass(errors.email)}
          placeholder="you@example.com"
        />
        <p className="mt-1 text-xs text-faint">ใช้สำหรับส่งใบยืนยันคำสั่งซื้อและติดตามพัสดุ</p>
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="street" className="block text-sm font-medium text-muted-foreground mb-1">
          ที่อยู่
        </label>
        <input
          id="street"
          type="text"
          value={form.street}
          onChange={(e) => setForm({ ...form, street: e.target.value })}
          className={fieldClass(errors.street)}
          placeholder="บ้านเลขที่ ถนน แขวง/ตำบล"
        />
        {errors.street && <p className="mt-1 text-xs text-destructive">{errors.street}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-muted-foreground mb-1">
            เขต/อำเภอ
          </label>
          <input
            id="city"
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className={fieldClass(errors.city)}
            placeholder="กรุงเทพมหานคร"
          />
          {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
        </div>
        <div>
          <label
            htmlFor="postalCode"
            className="block text-sm font-medium text-muted-foreground mb-1"
          >
            รหัสไปรษณีย์
          </label>
          <input
            id="postalCode"
            type="text"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            className={fieldClass(errors.postalCode)}
            placeholder="10100"
          />
          {errors.postalCode && (
            <p className="mt-1 text-xs text-destructive">{errors.postalCode}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-muted-foreground mb-1">
          ประเทศ
        </label>
        <select
          id="country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className={fieldClass()}
        >
          <option value="TH">ไทย</option>
          <option value="SG">สิงคโปร์</option>
          <option value="MY">มาเลเซีย</option>
          <option value="US">สหรัฐอเมริกา</option>
        </select>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1">
          เบอร์โทรศัพท์
        </label>
        <input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={fieldClass(errors.phone)}
          placeholder="0812345678"
        />
        {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
      </div>

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "กำลังโหลด…" : "ไปที่สรุปคำสั่งซื้อ"}
      </Button>
    </form>
  );
}
