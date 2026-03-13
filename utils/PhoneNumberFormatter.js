const FormatPhoneNumber = (businessPhoneNumber) => {
    businessPhoneNumber = businessPhoneNumber.replace(/\s/g, "");

  if (businessPhoneNumber.startsWith("0")) {
    businessPhoneNumber = "+61" + businessPhoneNumber.slice(1);
  }

   const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(businessPhoneNumber)) {
      return res.status(400).json({
        success: false,
        error: "Phone number must be in E.164 format e.g. +61412345678",
      });
    }
  return businessPhoneNumber;
};

export default FormatPhoneNumber;