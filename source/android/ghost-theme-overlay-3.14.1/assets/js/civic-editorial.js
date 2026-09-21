(function () {
  "use strict";

  var message = document.getElementById("civic-suggested-message");
  if (!message) {
    return;
  }

  var messageText = message.innerText.trim();
  var subjectLine = "Please make Columbia's crosswalk and U-turn laws meaningful on our streets";
  var emailLink = document.querySelector("[data-civic-email]");

  if (emailLink) {
    var recipient = emailLink.getAttribute("data-mailto-to") || "";
    var copyRecipients = emailLink.getAttribute("data-mailto-cc") || "";
    var messageBody = messageText.replace(/^Subject:[^\n]*\n+/, "");
    emailLink.href = "mailto:" + recipient +
      "?cc=" + encodeURIComponent(copyRecipients) +
      "&subject=" + encodeURIComponent(subjectLine) +
      "&body=" + encodeURIComponent(messageBody);
  }

  var copyButton = document.querySelector("[data-copy-civic-message]");
  var copyStatus = document.getElementById("civic-copy-status");

  if (!copyButton || !copyStatus) {
    return;
  }

  copyButton.addEventListener("click", function () {
    var copyOperation;

    if (navigator.clipboard && window.isSecureContext) {
      copyOperation = navigator.clipboard.writeText(messageText);
    } else {
      copyOperation = new Promise(function (resolve, reject) {
        var field = document.createElement("textarea");
        field.value = messageText;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();

        try {
          if (document.execCommand("copy")) {
            resolve();
          } else {
            reject(new Error("Copy command was not available."));
          }
        } catch (error) {
          reject(error);
        } finally {
          field.remove();
        }
      });
    }

    copyOperation.then(function () {
      copyStatus.textContent = "Suggested message copied. Edit it before sending.";
      copyButton.textContent = "Copied";
    }).catch(function () {
      copyStatus.textContent = "Copy was unavailable. Select the message above and copy it manually.";
    });
  });
}());
