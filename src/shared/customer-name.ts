export function customerNameParts(customer: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return {
    firstName: customer.firstName ?? customer.name ?? "",
    lastName: customer.lastName ?? "",
  };
}

export function validateCustomerName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (
    !first ||
    !last ||
    first.length > 60 ||
    last.length > 60 ||
    `${first} ${last}`.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(first + last)
  )
    throw new RangeError("Invalid customer name");
  return { firstName: first, lastName: last, name: `${first} ${last}` };
}
