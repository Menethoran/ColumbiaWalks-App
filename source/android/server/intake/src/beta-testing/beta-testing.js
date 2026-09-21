(function () {
  "use strict";

  var form = document.getElementById("beta-form");
  var street = document.getElementById("columbia-street");
  var streetMessage = document.getElementById("street-message");
  var message = document.getElementById("form-message");
  var submitButton = document.getElementById("submit-button");

  street.addEventListener("beforeinput", function (event) {
    if (event.data && /\p{N}/u.test(event.data)) {
      event.preventDefault();
      showStreetMessage("House numbers are not allowed. Enter the street name only.");
    }
  });
  street.addEventListener("input", function () {
    var cleaned = street.value.replace(/\p{N}/gu, "");
    if (cleaned !== street.value) {
      street.value = cleaned;
      showStreetMessage("Numbers were removed. Enter the street name only.");
    } else if (street.value.trim()) {
      showStreetMessage("");
    }
  });
  form.addEventListener("submit", submitRequest);

  async function submitRequest(event) {
    event.preventDefault();
    setMessage("", "");
    var platform = form.querySelector('input[name="platform"]:checked');
    if (!platform) return setMessage("error", "Choose Apple / iOS or Google / Android.");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (/\p{N}/u.test(street.value)) {
      street.focus();
      return showStreetMessage("House numbers are not allowed. Enter the street name only.");
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending request…";
    try {
      var response = await fetch("/columbiawalks-api/beta-testers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          request_id: uuid(),
          platform: platform.value,
          account_name: document.getElementById("account-name").value,
          account_email: document.getElementById("account-email").value,
          columbia_street: street.value,
          comments: document.getElementById("comments").value,
          privacy_consent: document.getElementById("privacy-consent").checked,
          website: document.getElementById("website").value
        })
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || "The request could not be submitted.");
      var selectedPlatform = platform.value === "ios" ? "Apple / iOS" : "Google / Android";
      form.reset();
      showStreetMessage("");
      setMessage("success", "Your " + selectedPlatform + " beta request was received. We will use your account email when testing access is available.");
    } catch (error) {
      setMessage("error", error.message || "The request could not be submitted. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Request beta access";
    }
  }

  function showStreetMessage(text) {
    streetMessage.textContent = text;
  }

  function setMessage(type, text) {
    message.className = "form-message" + (type ? " is-" + type : "");
    message.textContent = text;
    message.hidden = !text;
  }

  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (character) {
      return (character ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> character / 4).toString(16);
    });
  }
})();
