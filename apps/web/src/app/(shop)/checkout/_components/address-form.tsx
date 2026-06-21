"use client";

import { saveShippingAddress, shippingAddressAtom } from "@/application/atoms/checkout.atoms";
import type { ShippingAddressFormData } from "@/application/atoms/checkout.atoms";
import { Atom, useAtom, useAtomSet } from "@effect-atom/atom-react";
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
    if (form.recipientName.trim().length < 2) newErrors.recipientName = "Name is required";
    if (form.street.trim().length < 5) newErrors.street = "Street address is required";
    if (form.city.trim().length < 2) newErrors.city = "City is required";
    if (form.postalCode.trim().length < 4) newErrors.postalCode = "Postal code is required";
    if (form.phone.trim().length < 9) newErrors.phone = "Phone number is required";
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
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      err ? "border-red-300" : "border-gray-300"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>

      <div>
        <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
          Recipient Name
        </label>
        <input
          id="recipientName"
          type="text"
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          className={fieldClass(errors.recipientName)}
          placeholder="Full name"
        />
        {errors.recipientName && (
          <p className="mt-1 text-xs text-red-500">{errors.recipientName}</p>
        )}
      </div>

      <div>
        <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
          Street Address
        </label>
        <input
          id="street"
          type="text"
          value={form.street}
          onChange={(e) => setForm({ ...form, street: e.target.value })}
          className={fieldClass(errors.street)}
          placeholder="123 Main St"
        />
        {errors.street && <p className="mt-1 text-xs text-red-500">{errors.street}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            id="city"
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className={fieldClass(errors.city)}
            placeholder="Bangkok"
          />
          {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
        </div>
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code
          </label>
          <input
            id="postalCode"
            type="text"
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            className={fieldClass(errors.postalCode)}
            placeholder="10100"
          />
          {errors.postalCode && <p className="mt-1 text-xs text-red-500">{errors.postalCode}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
          Country
        </label>
        <select
          id="country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className={fieldClass()}
        >
          <option value="TH">Thailand</option>
          <option value="SG">Singapore</option>
          <option value="MY">Malaysia</option>
          <option value="US">United States</option>
        </select>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={fieldClass(errors.phone)}
          placeholder="+66812345678"
        />
        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Loading…" : "Continue to Order Summary"}
      </button>
    </form>
  );
}
