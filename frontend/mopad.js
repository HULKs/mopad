class Mopad {
  constructor(root) {
    this.root = root;
    this.webSocket = null;
    this.connectMessage = null;

    this.users = {};

    this.loading = new Loading();
    this.login = new Login(
      (name, team, password) => {
        this.connectMessage = { Login: { name, team, password } };
        this.connectWebSocket(this.connectMessage);
      },
      () => {
        this.root.removeChild(this.login.element);
        this.root.appendChild(this.register.element);
        this.root.classList.add("center");
        this.register.focus();
      }
    );
    this.register = new Register(
      (name, team, password) => {
        this.connectMessage = { Register: { name, team, password } };
        this.connectWebSocket(this.connectMessage);
      },
      () => {
        this.root.removeChild(this.register.element);
        this.root.appendChild(this.login.element);
        this.root.classList.add("center");
        this.login.focus();
      }
    );
    this.talks = new Talks(
      (message) => {
        this.webSocket.send(JSON.stringify(message));
      },
      () => {
        localStorage.removeItem("reloginToken");
        this.root.removeChild(this.talks.element);
        this.root.appendChild(this.login.element);
        this.root.classList.add("center");
        this.login.focus();
      }
    );

    this.root.appendChild(this.loading.element);
    this.root.classList.add("center");

    this.retrieveTeams();
  }

  async retrieveTeams() {
    const teamsResponse = await fetch("/teams.json");
    const teams = await teamsResponse.json();

    this.login.updateTeams(teams);
    this.register.updateTeams(teams);

    this.root.removeChild(this.loading.element);
    this.root.appendChild(this.login.element);
    this.root.classList.add("center");
    this.login.focus();

    this.tryRelogin();
  }

  tryRelogin() {
    if (this.webSocket === null) {
      const reloginToken = localStorage.getItem("reloginToken");
      if (reloginToken !== null) {
        this.connectWebSocket({ Relogin: { token: reloginToken } });
      } else if (
        this.connectMessage !== null &&
        this.connectMessage["Login"] !== undefined
      ) {
        this.connectWebSocket(this.connectMessage);
      } else if (
        this.connectMessage !== null &&
        this.connectMessage["Register"] !== undefined
      ) {
        this.connectWebSocket({
          Register: {
            name: this.connectMessage["Register"]["name"],
            team: this.connectMessage["Register"]["team"],
            password: this.connectMessage["Register"]["password"],
          },
        });
      }
    }
  }

  connectWebSocket(connectMessage) {
    this.login.disable();
    this.register.disable();
    this.webSocket = new WebSocket(
      `ws${window.location.protocol === "https:" ? "s" : ""}://${
        window.location.host
      }/api`
    );
    this.webSocket.addEventListener("open", () => {
      this.webSocket.send(JSON.stringify(connectMessage));
    });
    this.webSocket.addEventListener("close", () => {
      if (this.talks.element.parentElement === this.root) {
        this.root.removeChild(this.talks.element);
        this.root.appendChild(this.login.element);
        this.root.classList.add("center");
      }
      this.login.enable();
      this.register.enable();
      this.login.focus();
      this.webSocket = null;
    });
    this.webSocket.addEventListener("message", (event) => {
      let message = JSON.parse(event.data);
      if (message["AuthenticationSuccess"] !== undefined) {
        this.currentUserId = message["AuthenticationSuccess"]["user_id"];
        localStorage.setItem(
          "reloginToken",
          message["AuthenticationSuccess"]["token"]
        );
        this.talks.setCurrentUserIdAndRoles(
          message["AuthenticationSuccess"]["user_id"],
          message["AuthenticationSuccess"]["roles"]
        );
        this.login.enable();
        this.register.enable();
        while (this.root.firstChild) {
          this.root.removeChild(this.root.firstChild);
        }
        this.root.appendChild(this.talks.element);
        this.root.classList.remove("center");
      } else if (message["AuthenticationError"] !== undefined) {
        if (connectMessage["Relogin"] === undefined) {
          alert(
            `Chestboard reported that we cannot ${
              authenticationCommand === "Login" ? "log" : "register"
            } you${authenticationCommand === "Login" ? " in" : ""} (${
              message["AuthenticationError"]["reason"]
            })`
          );
        } else {
          localStorage.removeItem("reloginToken");
        }
        this.login.enable();
        this.register.enable();
      } else if (message["Users"] !== undefined) {
        this.users = message["Users"]["users"];
        this.talks.updateUsers(message["Users"]["users"]);
      } else if (message["AddTalk"] !== undefined) {
        this.talks.addTalk(message["AddTalk"]["talk"]);
        if (
          message["AddTalk"]["talk"]["title"] ===
          `The talk from ${this.users[this.currentUserId].name}`
        ) {
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
        }
      } else if (message["RemoveTalk"] !== undefined) {
        this.talks.removeTalk(message["RemoveTalk"]["talk_id"]);
      } else if (message["UpdateTitle"] !== undefined) {
        this.talks.updateTitle(
          message["UpdateTitle"]["talk_id"],
          message["UpdateTitle"]["title"]
        );
      } else if (message["UpdateDescription"] !== undefined) {
        this.talks.updateDescription(
          message["UpdateDescription"]["talk_id"],
          message["UpdateDescription"]["description"]
        );
      } else if (message["UpdateScheduledAt"] !== undefined) {
        this.talks.updateScheduledAt(
          message["UpdateScheduledAt"]["talk_id"],
          message["UpdateScheduledAt"]["scheduled_at"]
        );
      } else if (message["UpdateDuration"] !== undefined) {
        this.talks.updateDuration(
          message["UpdateDuration"]["talk_id"],
          message["UpdateDuration"]["duration"]
        );
      } else if (message["AddNoob"] !== undefined) {
        this.talks.addNoob(
          message["AddNoob"]["talk_id"],
          message["AddNoob"]["user_id"]
        );
      } else if (message["RemoveNoob"] !== undefined) {
        this.talks.removeNoob(
          message["RemoveNoob"]["talk_id"],
          message["RemoveNoob"]["user_id"]
        );
      } else if (message["AddNerd"] !== undefined) {
        this.talks.addNerd(
          message["AddNerd"]["talk_id"],
          message["AddNerd"]["user_id"]
        );
      } else if (message["RemoveNerd"] !== undefined) {
        this.talks.removeNerd(
          message["RemoveNerd"]["talk_id"],
          message["RemoveNerd"]["user_id"]
        );
      }
    });
  }

  minuteTick() {
    this.talks.minuteTick();
  }
}

class Loading {
  constructor() {
    this.element = document.createElement("div");
    this.element.id = "loading";

    const heading = this.element.appendChild(document.createElement("h1"));
    heading.innerText = "MOPAD";

    const loading = this.element.appendChild(document.createElement("div"));
    loading.innerText = "Booting chestboard...";
  }
}

class Login {
  constructor(login, switchToRegister) {
    this.element = document.createElement("div");
    this.element.id = "login";

    const heading1Element = this.element.appendChild(
      document.createElement("h1")
    );
    heading1Element.innerText = "MOPAD";

    const heading2Element = this.element.appendChild(
      document.createElement("h2")
    );
    heading2Element.innerText =
      "Moderated Organization PAD (powerful, agile, distributed)";

    const heading3Element = this.element.appendChild(
      document.createElement("h3")
    );
    heading3Element.innerText = "Login";

    this.nameElement = this.element.appendChild(
      document.createElement("input")
    );
    this.nameElement.type = "text";
    this.nameElement.placeholder = "Your Name";
    this.nameElement.autofocus = true;
    this.nameElement.addEventListener("input", () => {
      this.enableButton();
    });

    this.teamElement = this.element.appendChild(
      document.createElement("select")
    );

    this.passwordElement = this.element.appendChild(
      document.createElement("input")
    );
    this.passwordElement.type = "password";
    this.passwordElement.placeholder = "Your Password";
    this.passwordElement.addEventListener("input", () => {
      this.enableButton();
    });

    this.buttonElement = this.element.appendChild(
      document.createElement("button")
    );
    this.buttonElement.innerText = "Login";
    this.buttonElement.addEventListener("click", () => {
      login(
        this.nameElement.value,
        this.teamElement.value,
        this.passwordElement.value
      );
    });

    this.enableButton();

    const noAccountElement = this.element.appendChild(
      document.createElement("div")
    );
    noAccountElement.classList.add("login-register-switcher");

    noAccountElement.appendChild(
      document.createTextNode("Don't have an account? ")
    );

    const switchToRegisterElement = noAccountElement.appendChild(
      document.createElement("a")
    );
    switchToRegisterElement.href = "#register";
    switchToRegisterElement.innerText = "Register";
    switchToRegisterElement.addEventListener("click", (event) => {
      event.preventDefault();
      if (!this.nameElement.disabled) {
        switchToRegister();
      }
    });

    const footerElement = this.element.appendChild(
      document.createElement("div")
    );
    footerElement.classList.add("footer");

    const imprintElement = footerElement.appendChild(
      document.createElement("a")
    );
    imprintElement.href = "https://rohow.de/2020/de/imprint.html";
    imprintElement.target = "_blank";
    imprintElement.rel = "noreferrer";
    imprintElement.innerText = "Imprint/Impressum";

    const privacyPolicyElement = footerElement.appendChild(
      document.createElement("a")
    );
    privacyPolicyElement.href = "https://rohow.de/2020/de/privacy_policy.html";
    privacyPolicyElement.target = "_blank";
    privacyPolicyElement.rel = "noreferrer";
    privacyPolicyElement.innerText = "Privacy Policy/Datenschutzerklärung";
  }

  focus() {
    this.nameElement.focus();
  }

  enable() {
    this.nameElement.disabled = false;
    this.teamElement.disabled = false;
    this.passwordElement.disabled = false;
    this.buttonElement.disabled = false;
  }

  disable() {
    this.nameElement.disabled = true;
    this.teamElement.disabled = true;
    this.passwordElement.disabled = true;
    this.buttonElement.disabled = true;
  }

  enableButton() {
    this.buttonElement.disabled =
      this.nameElement.value.length === 0 ||
      this.passwordElement.value.length === 0;
  }

  updateTeams(teams) {
    while (this.teamElement.firstChild) {
      this.teamElement.removeChild(this.teamElement.firstChild);
    }

    for (let team of teams) {
      const optionElement = this.teamElement.appendChild(
        document.createElement("option")
      );
      optionElement.innerText = team;
    }
  }
}

class Register {
  constructor(register, switchToLogin) {
    this.element = document.createElement("div");
    this.element.id = "register";

    const heading1Element = this.element.appendChild(
      document.createElement("h1")
    );
    heading1Element.innerText = "MOPAD";

    const heading2Element = this.element.appendChild(
      document.createElement("h2")
    );
    heading2Element.innerText =
      "Moderated Organization PAD (powerful, agile, distributed)";

    const heading3Element = this.element.appendChild(
      document.createElement("h3")
    );
    heading3Element.innerText = "Register";

    this.nameElement = this.element.appendChild(
      document.createElement("input")
    );
    this.nameElement.type = "text";
    this.nameElement.placeholder = "Your Name";
    this.nameElement.autofocus = true;
    this.nameElement.addEventListener("input", () => {
      this.enableButton();
    });

    const nameHintElement = this.element.appendChild(
      document.createElement("div")
    );
    nameHintElement.classList.add("hint");
    nameHintElement.innerText = "Unique in your team, visible to everyone";

    this.teamElement = this.element.appendChild(
      document.createElement("select")
    );

    const teamHintElement = this.element.appendChild(
      document.createElement("div")
    );
    teamHintElement.classList.add("hint");
    teamHintElement.innerText = "Visible to everyone";

    this.passwordElement = this.element.appendChild(
      document.createElement("input")
    );
    this.passwordElement.type = "password";
    this.passwordElement.placeholder = "Your Password";
    this.passwordElement.addEventListener("input", () => {
      this.enableButton();
    });

    const iAmNotANaoBoxElement = this.element.appendChild(
      document.createElement("div")
    );
    iAmNotANaoBoxElement.classList.add("i-am-not-a-nao");

    this.iAmNotANaoElement = iAmNotANaoBoxElement.appendChild(
      document.createElement("input")
    );
    this.iAmNotANaoElement.type = "checkbox";
    this.iAmNotANaoElement.id = "i-am-not-a-nao";
    this.iAmNotANaoElement.addEventListener("input", () => {
      this.enableButton();
    });

    const iAmNotANaoLabelElement = iAmNotANaoBoxElement.appendChild(
      document.createElement("label")
    );
    iAmNotANaoLabelElement.setAttribute("for", "i-am-not-a-nao");
    iAmNotANaoLabelElement.innerText = "I'm not a NAO";

    this.buttonElement = this.element.appendChild(
      document.createElement("button")
    );
    this.buttonElement.innerText = "Register";
    this.buttonElement.addEventListener("click", () => {
      if (!this.iAmNotANaoElement.checked) {
        alert("NAOs are not allowed in MOPAD");
        return;
      }
      register(
        this.nameElement.value,
        this.teamElement.value,
        this.passwordElement.value
      );
    });

    this.enableButton();

    const existingAccountElement = this.element.appendChild(
      document.createElement("div")
    );
    existingAccountElement.classList.add("login-register-switcher");

    existingAccountElement.appendChild(
      document.createTextNode("Already have an account? ")
    );

    const switchToLoginElement = existingAccountElement.appendChild(
      document.createElement("a")
    );
    switchToLoginElement.href = "#login";
    switchToLoginElement.innerText = "Login";
    switchToLoginElement.addEventListener("click", (event) => {
      event.preventDefault();
      if (!this.nameElement.disabled) {
        switchToRegister();
      }
    });

    const footerElement = this.element.appendChild(
      document.createElement("div")
    );
    footerElement.classList.add("footer");

    const imprintElement = footerElement.appendChild(
      document.createElement("a")
    );
    imprintElement.href = "https://rohow.de/2020/de/imprint.html";
    imprintElement.target = "_blank";
    imprintElement.rel = "noreferrer";
    imprintElement.innerText = "Imprint/Impressum";

    const privacyPolicyElement = footerElement.appendChild(
      document.createElement("a")
    );
    privacyPolicyElement.href = "https://rohow.de/2020/de/privacy_policy.html";
    privacyPolicyElement.target = "_blank";
    privacyPolicyElement.rel = "noreferrer";
    privacyPolicyElement.innerText = "Privacy Policy/Datenschutzerklärung";
  }

  focus() {
    this.nameElement.focus();
  }

  enable() {
    this.nameElement.disabled = false;
    this.teamElement.disabled = false;
    this.passwordElement.disabled = false;
    this.iAmNotANaoElement.disabled = false;
    this.buttonElement.disabled = false;
  }

  disable() {
    this.nameElement.disabled = true;
    this.teamElement.disabled = true;
    this.passwordElement.disabled = true;
    this.iAmNotANaoElement.disabled = true;
    this.buttonElement.disabled = true;
  }

  enableButton() {
    this.buttonElement.disabled =
      this.nameElement.value.length === 0 ||
      this.passwordElement.value.length === 0 ||
      !this.iAmNotANaoElement.checked;
  }

  updateTeams(teams) {
    while (this.teamElement.firstChild) {
      this.teamElement.removeChild(this.teamElement.firstChild);
    }

    for (let team of teams) {
      const optionElement = this.teamElement.appendChild(
        document.createElement("option")
      );
      optionElement.innerText = team;
    }
  }
}

class Talks {
  constructor(sendMessage, logout) {
    this.element = document.createElement("div");
    this.element.id = "talks";

    this.sendMessage = sendMessage;

    this.talks = {};
    this.sectionElementsOfTalks = {};
    this.users = {};

    this.pastExpanded = false;
    this.currentExpanded = true;
    this.upcomingExpanded = true;
    this.unscheduledExpanded = true;

    const addButtonElement = this.element.appendChild(
      document.createElement("div")
    );
    addButtonElement.classList.add("add");
    addButtonElement.innerText = "+";
    addButtonElement.addEventListener("click", () => {
      sendMessage({
        AddTalk: {
          title: `The talk from ${this.users[this.currentUserId].name}`,
          description:
            "You can change the title, duration, and description by clicking on them",
          duration: { secs: 30 * 60, nanos: 0 },
        },
      });
    });

    this.calendarDialogElement = this.element.appendChild(
      document.createElement("div")
    );
    this.calendarDialogElement.classList.add("calendar-dialog");
    this.calendarDialogElement.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        this.calendarDialogElement.classList.remove("open");
      }
    });

    const calendarDialogBoxElement = this.calendarDialogElement.appendChild(
      document.createElement("div")
    );
    calendarDialogBoxElement.classList.add("box");

    const calendarHeading1Element = calendarDialogBoxElement.appendChild(
      document.createElement("h1")
    );
    calendarHeading1Element.innerText = "Subscribe talks as calendar";

    const calendarHeading2Element = calendarDialogBoxElement.appendChild(
      document.createElement("h2")
    );
    calendarHeading2Element.innerText = "Nerds might know it as iCalendar/ICS";

    this.calendarDescriptionElement = calendarDialogBoxElement.appendChild(
      document.createElement("div")
    );
    this.calendarDescriptionElement.classList.add("description");
    this.calendarDescriptionElement.innerText =
      "Use this address in external calendar applications to show your subscribed talks:";

    this.calendarLinkElement = calendarDialogBoxElement.appendChild(
      document.createElement("a")
    );
    this.calendarLinkElement.href = `${window.location.protocol}//${window.location.host}/talks.ics?user_id=${this.currentUserId}`;
    this.calendarLinkElement.target = "_blank";
    this.calendarLinkElement.rel = "noreferrer";
    this.calendarLinkElement.innerText = `${window.location.protocol}//${window.location.host}/talks.ics?user_id=${this.currentUserId}`;

    const calendarPersonalizationElement = calendarDialogBoxElement.appendChild(
      document.createElement("div")
    );
    calendarPersonalizationElement.classList.add("personalization");

    this.calendarPersonalizationCheckboxElement =
      calendarPersonalizationElement.appendChild(
        document.createElement("input")
      );
    this.calendarPersonalizationCheckboxElement.id = "calendar-checkbox";
    this.calendarPersonalizationCheckboxElement.type = "checkbox";
    this.calendarPersonalizationCheckboxElement.checked = true;
    this.calendarPersonalizationCheckboxElement.addEventListener(
      "input",
      () => {
        this.updateCalendarElements();
      }
    );

    const calendarPersonalizationLabelElement =
      calendarPersonalizationElement.appendChild(
        document.createElement("label")
      );
    calendarPersonalizationLabelElement.setAttribute(
      "for",
      "calendar-checkbox"
    );
    calendarPersonalizationLabelElement.innerText =
      "Only include your NERDed and NOOBed talks";

    const calendarHintElement = calendarDialogBoxElement.appendChild(
      document.createElement("div")
    );
    calendarHintElement.classList.add("hint");
    calendarHintElement.innerText =
      "The calendar will only contain scheduled talks.";

    const headingElement = this.element.appendChild(
      document.createElement("div")
    );
    headingElement.classList.add("title");

    const heading1Element = headingElement.appendChild(
      document.createElement("h1")
    );
    heading1Element.innerText = "MOPAD";

    const calendarLinkElement = headingElement.appendChild(
      document.createElement("a")
    );
    calendarLinkElement.classList.add("calendar");
    calendarLinkElement.href = "#calendar";
    calendarLinkElement.innerText = "Subscribe as calendar";
    calendarLinkElement.addEventListener("click", (event) => {
      event.preventDefault();
      this.calendarDialogElement.classList.add("open");
    });

    this.pastHeadingElement = document.createElement("div");
    this.pastHeadingElement.classList.add("heading");

    const pastHeading2Element = this.pastHeadingElement.appendChild(
      document.createElement("h2")
    );
    pastHeading2Element.innerText = "Past talks";

    this.pastButtonElement = this.pastHeadingElement.appendChild(
      document.createElement("button")
    );
    this.pastButtonElement.addEventListener("click", () => {
      this.pastExpanded = !this.pastExpanded;
      this.updateVisibleSections();
    });

    this.pastTalksElement = document.createElement("div");
    this.pastTalksElement.classList.add("talks");

    this.currentHeadingElement = document.createElement("div");
    this.currentHeadingElement.classList.add("heading");

    const currentHeading2Element = this.currentHeadingElement.appendChild(
      document.createElement("h2")
    );
    currentHeading2Element.innerText = "Current talks";

    this.currentButtonElement = this.currentHeadingElement.appendChild(
      document.createElement("button")
    );
    this.currentButtonElement.addEventListener("click", () => {
      this.currentExpanded = !this.currentExpanded;
      this.updateVisibleSections();
    });

    this.currentTalksElement = document.createElement("div");
    this.currentTalksElement.classList.add("talks");

    this.upcomingHeadingElement = document.createElement("div");
    this.upcomingHeadingElement.classList.add("heading");

    const upcomingHeading2Element = this.upcomingHeadingElement.appendChild(
      document.createElement("h2")
    );
    upcomingHeading2Element.innerText = "Upcoming talks";

    this.upcomingButtonElement = this.upcomingHeadingElement.appendChild(
      document.createElement("button")
    );
    this.upcomingButtonElement.addEventListener("click", () => {
      this.upcomingExpanded = !this.upcomingExpanded;
      this.updateVisibleSections();
    });

    this.upcomingTalksElement = document.createElement("div");
    this.upcomingTalksElement.classList.add("talks");

    this.unscheduledHeadingElement = document.createElement("div");
    this.unscheduledHeadingElement.classList.add("heading");

    const unscheduledHeading2Element =
      this.unscheduledHeadingElement.appendChild(document.createElement("h2"));
    unscheduledHeading2Element.innerText = "Unscheduled talks";

    this.unscheduledButtonElement = this.unscheduledHeadingElement.appendChild(
      document.createElement("button")
    );
    this.unscheduledButtonElement.addEventListener("click", () => {
      this.unscheduledExpanded = !this.unscheduledExpanded;
      this.updateVisibleSections();
    });

    this.unscheduledTalksElement = document.createElement("div");
    this.unscheduledTalksElement.classList.add("talks");

    this.footerElement = document.createElement("div");
    this.footerElement.classList.add("footer");

    const logoutElement = this.footerElement.appendChild(
      document.createElement("a")
    );
    logoutElement.href = "#logout";
    logoutElement.innerText = "Logout from MOPAD";
    logoutElement.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });

    const imprintElement = this.footerElement.appendChild(
      document.createElement("a")
    );
    imprintElement.href = "https://rohow.de/2020/de/imprint.html";
    imprintElement.target = "_blank";
    imprintElement.rel = "noreferrer";
    imprintElement.innerText = "Imprint/Impressum";

    const privacyPolicyElement = this.footerElement.appendChild(
      document.createElement("a")
    );
    privacyPolicyElement.href = "https://rohow.de/2020/de/privacy_policy.html";
    privacyPolicyElement.target = "_blank";
    privacyPolicyElement.rel = "noreferrer";
    privacyPolicyElement.innerText = "Privacy Policy/Datenschutzerklärung";
  }

  minuteTick() {
    for (const talkId of Object.keys(this.talks)) {
      const currentSectionElement = this.sectionElementsOfTalks[talkId];
      const targetSectionElement = this.sectionNameToSectionElement(
        this.talks[talkId].getTargetSectionName()
      );
      if (currentSectionElement !== targetSectionElement) {
        currentSectionElement.removeChild(this.talks[talkId].element);
        this.insertTalkIntoSectionElement(talkId, targetSectionElement);
      }
      this.talks[talkId].minuteTick();
    }
    this.updateVisibleSections();
  }

  setCurrentUserIdAndRoles(currentUserId, roles) {
    this.currentUserId = currentUserId;
    this.roles = roles;
    this.updateCalendarElements();
  }

  updateCalendarElements() {
    if (this.calendarPersonalizationCheckboxElement.checked) {
      this.calendarDescriptionElement.innerText =
        "Use this address in external calendar applications to show your subscribed talks:";
      this.calendarLinkElement.href = `${window.location.protocol}//${window.location.host}/talks.ics?user_id=${this.currentUserId}`;
      this.calendarLinkElement.innerText = `${window.location.protocol}//${window.location.host}/talks.ics?user_id=${this.currentUserId}`;
    } else {
      this.calendarDescriptionElement.innerText =
        "Use this address in external calendar applications to show the talks:";
      this.calendarLinkElement.href = `${window.location.protocol}//${window.location.host}/talks.ics`;
      this.calendarLinkElement.innerText = `${window.location.protocol}//${window.location.host}/talks.ics`;
    }
  }

  sectionNameToSectionElement(name) {
    switch (name) {
      case "past":
        return this.pastTalksElement;
      case "current":
        return this.currentTalksElement;
      case "upcoming":
        return this.upcomingTalksElement;
      case "unscheduled":
        return this.unscheduledTalksElement;
    }

    return null;
  }

  insertTalkIntoSectionElement(talkId, sectionElement) {
    if (sectionElement === this.unscheduledTalksElement) {
      sectionElement.appendChild(this.talks[talkId].element);
    }
    const otherTalksInSection = Object.entries(
      this.sectionElementsOfTalks
    ).filter(
      ([_otherTalkId, sectionElementOfTalk]) =>
        sectionElementOfTalk === sectionElement
    );
    otherTalksInSection.sort(
      (
        [leftTalkId, _leftSectionElement],
        [rightTalkId, _rightSectionElement]
      ) => {
        if (
          this.talks[leftTalkId].scheduledAt === null ||
          this.talks[rightTalkId].scheduledAt === null
        ) {
          return 0;
        }
        return (
          this.talks[leftTalkId].scheduledAt.secs_since_epoch -
          this.talks[rightTalkId].scheduledAt.secs_since_epoch
        );
      }
    );
    const talkOfLaterScheduledAt = otherTalksInSection.find(
      ([otherTalkId, _sectionElement]) =>
        this.talks[otherTalkId].scheduledAt !== null &&
        this.talks[talkId].scheduledAt !== null &&
        this.talks[otherTalkId].scheduledAt.secs_since_epoch >
          this.talks[talkId].scheduledAt.secs_since_epoch
    );
    if (talkOfLaterScheduledAt !== undefined) {
      const [talkIdOfLaterScheduledAt, _] = talkOfLaterScheduledAt;
      sectionElement.insertBefore(
        this.talks[talkId].element,
        this.talks[talkIdOfLaterScheduledAt].element
      );
    } else {
      sectionElement.appendChild(this.talks[talkId].element);
    }
    this.sectionElementsOfTalks[talkId] = sectionElement;
  }

  updateVisibleSections() {
    if (this.pastHeadingElement.parentElement === this.element) {
      this.element.removeChild(this.pastHeadingElement);
    }
    if (this.pastTalksElement.parentElement === this.element) {
      this.element.removeChild(this.pastTalksElement);
    }
    const pastTalks = Object.values(this.sectionElementsOfTalks).filter(
      (sectionElementOfTalk) => sectionElementOfTalk == this.pastTalksElement
    ).length;
    if (pastTalks > 0) {
      this.element.appendChild(this.pastHeadingElement);
      if (this.pastExpanded) {
        this.element.appendChild(this.pastTalksElement);
        this.pastButtonElement.innerText = "Hide past";
      } else {
        this.pastButtonElement.innerText = `Show ${pastTalks} past`;
      }
    }

    if (this.currentHeadingElement.parentElement === this.element) {
      this.element.removeChild(this.currentHeadingElement);
    }
    if (this.currentTalksElement.parentElement === this.element) {
      this.element.removeChild(this.currentTalksElement);
    }
    const currentTalks = Object.values(this.sectionElementsOfTalks).filter(
      (sectionElementOfTalk) => sectionElementOfTalk == this.currentTalksElement
    ).length;
    if (currentTalks > 0) {
      this.element.appendChild(this.currentHeadingElement);
      if (this.currentExpanded) {
        this.element.appendChild(this.currentTalksElement);
        this.currentButtonElement.innerText = "Hide current";
      } else {
        this.currentButtonElement.innerText = `Show ${currentTalks} current`;
      }
    }

    if (this.upcomingHeadingElement.parentElement === this.element) {
      this.element.removeChild(this.upcomingHeadingElement);
    }
    if (this.upcomingTalksElement.parentElement === this.element) {
      this.element.removeChild(this.upcomingTalksElement);
    }
    const upcomingTalks = Object.values(this.sectionElementsOfTalks).filter(
      (sectionElementOfTalk) =>
        sectionElementOfTalk == this.upcomingTalksElement
    ).length;
    if (upcomingTalks > 0) {
      this.element.appendChild(this.upcomingHeadingElement);
      if (this.upcomingExpanded) {
        this.element.appendChild(this.upcomingTalksElement);
        this.upcomingButtonElement.innerText = "Hide upcoming";
      } else {
        this.upcomingButtonElement.innerText = `Show ${upcomingTalks} upcoming`;
      }
    }

    if (this.unscheduledHeadingElement.parentElement === this.element) {
      this.element.removeChild(this.unscheduledHeadingElement);
    }
    if (this.unscheduledTalksElement.parentElement === this.element) {
      this.element.removeChild(this.unscheduledTalksElement);
    }
    const unscheduledTalks = Object.values(this.sectionElementsOfTalks).filter(
      (sectionElementOfTalk) =>
        sectionElementOfTalk == this.unscheduledTalksElement
    ).length;
    if (unscheduledTalks > 0) {
      this.element.appendChild(this.unscheduledHeadingElement);
      if (this.unscheduledExpanded) {
        this.element.appendChild(this.unscheduledTalksElement);
        this.unscheduledButtonElement.innerText = "Hide unscheduled";
      } else {
        this.unscheduledButtonElement.innerText = `Show ${unscheduledTalks} unscheduled`;
      }
    }

    if (this.footerElement.parentElement === this.element) {
      this.element.removeChild(this.footerElement);
    }
    this.element.appendChild(this.footerElement);
  }

  updateUsers(users) {
    this.users = users;
    for (const talk of Object.values(this.talks)) {
      talk.updateUsers(users);
    }
  }

  addTalk(talk) {
    if (this.talks[talk.id] !== undefined) {
      return;
    }
    this.talks[talk.id] = new Talk(
      talk,
      this.users,
      this.currentUserId,
      this.roles,
      this.sendMessage
    );
    const sectionElement = this.sectionNameToSectionElement(
      this.talks[talk.id].getTargetSectionName()
    );
    this.insertTalkIntoSectionElement(talk.id, sectionElement);
    this.updateVisibleSections();
  }

  removeTalk(talkId) {
    this.sectionElementsOfTalks[talkId].removeChild(this.talks[talkId].element);
    delete this.sectionElementsOfTalks[talkId];
    this.updateVisibleSections();
    delete this.talks[talkId];
  }

  updateTitle(talkId, title) {
    this.talks[talkId].updateTitle(title);
  }

  updateDescription(talkId, description) {
    this.talks[talkId].updateDescription(description);
  }

  updateScheduledAt(talkId, scheduledAt) {
    this.talks[talkId].updateScheduledAt(scheduledAt);
    const currentSectionElement = this.sectionElementsOfTalks[talkId];
    const targetSectionElement = this.sectionNameToSectionElement(
      this.talks[talkId].getTargetSectionName()
    );
    if (currentSectionElement !== targetSectionElement) {
      currentSectionElement.removeChild(this.talks[talkId].element);
      this.insertTalkIntoSectionElement(talkId, targetSectionElement);
      this.updateVisibleSections();
    }
  }

  updateDuration(talkId, duration) {
    this.talks[talkId].updateDuration(duration);
  }

  addNoob(talkId, userId) {
    this.talks[talkId].addNoob(userId);
  }

  removeNoob(talkId, userId) {
    this.talks[talkId].removeNoob(userId);
  }

  addNerd(talkId, userId) {
    this.talks[talkId].addNerd(userId);
  }

  removeNerd(talkId, userId) {
    this.talks[talkId].removeNerd(userId);
  }
}

class Talk {
  constructor(talk, users, currentUserId, roles, sendMessage) {
    this.element = document.createElement("div");
    this.element.classList.add("talk");

    this.id = talk.id;
    this.creator = talk.creator;
    this.title = talk.title;
    this.description = talk.description;
    this.scheduledAt = talk.scheduled_at;
    this.duration = talk.duration;
    this.noobs = talk.noobs;
    this.nerds = talk.nerds;

    this.users = users;
    this.currentUserId = currentUserId;
    this.roles = roles;

    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      const deleteButtonElement = this.element.appendChild(
        document.createElement("div")
      );
      deleteButtonElement.classList.add("delete");
      deleteButtonElement.innerText = "\u2015";
      deleteButtonElement.addEventListener("click", () => {
        if (confirm("Do you really want to delete this talk?")) {
          sendMessage({
            RemoveTalk: {
              talk_id: this.id,
            },
          });
        }
      });
    }

    this.titleElement = this.element.appendChild(document.createElement("h1"));
    this.titleElement.classList.add("title");
    this.titleElement.innerText = this.title;
    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      this.titleElement.classList.add("editable");
      this.titleElement.addEventListener("click", () => {
        this.titleEditElement.value = this.title;
        this.element.replaceChild(this.titleEditElement, this.titleElement);
        this.titleEditElement.focus();
      });

      this.titleEditElement = document.createElement("input");
      this.titleEditElement.classList.add("title");
      this.titleEditElement.type = "text";
      this.titleEditElement.addEventListener("input", () => {
        sendMessage({
          UpdateTitle: {
            talk_id: this.id,
            title: this.titleEditElement.value,
          },
        });
      });
      this.titleEditElement.addEventListener("blur", () => {
        this.element.replaceChild(this.titleElement, this.titleEditElement);
      });
    }

    this.scheduledAtElement = this.element.appendChild(
      document.createElement("div")
    );
    this.scheduledAtElement.classList.add("scheduled-at");
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    if (this.roles.includes("Scheduler")) {
      this.scheduledAtElement.classList.add("editable");
      this.scheduledAtElement.addEventListener("click", () => {
        if (this.scheduledAt) {
          const beginDate = new Date(this.scheduledAt.secs_since_epoch * 1000);
          this.scheduledAtEditElement.value = `${beginDate.getFullYear()}-${(
            beginDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}-${beginDate
            .getDate()
            .toString()
            .padStart(2, "0")}T${beginDate
            .getHours()
            .toString()
            .padStart(2, "0")}:${beginDate
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
        } else {
          this.scheduledAtEditElement.value = "";
        }
        this.element.replaceChild(
          this.scheduledAtEditElement,
          this.scheduledAtElement
        );
        this.scheduledAtEditElement.focus();
      });

      this.scheduledAtEditElement = document.createElement("input");
      this.scheduledAtEditElement.classList.add("scheduled-at");
      this.scheduledAtEditElement.type = "datetime-local";
      this.scheduledAtEditElement.addEventListener("blur", () => {
        let scheduledAt = null;
        if (this.scheduledAtEditElement.value.length > 0) {
          scheduledAt = {
            secs_since_epoch: Math.floor(
              new Date(this.scheduledAtEditElement.value) / 1000
            ),
            nanos_since_epoch: 0,
          };
        }
        sendMessage({
          UpdateScheduledAt: {
            talk_id: this.id,
            scheduled_at: scheduledAt,
          },
        });
        this.element.replaceChild(
          this.scheduledAtElement,
          this.scheduledAtEditElement
        );
      });
    }

    this.durationElement = this.element.appendChild(
      document.createElement("div")
    );
    this.durationElement.classList.add("duration");
    this.durationElement.innerText = this.generateDuration();
    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      this.durationElement.classList.add("editable");
      this.durationElement.addEventListener("click", () => {
        this.durationEditElement.value = Math.floor(this.duration.secs / 60);
        this.element.replaceChild(
          this.durationEditElement,
          this.durationElement
        );
        this.durationEditElement.focus();
      });

      this.durationEditElement = document.createElement("input");
      this.durationEditElement.classList.add("duration");
      this.durationEditElement.type = "number";
      this.durationEditElement.min = 1;
      this.durationEditElement.max = 600;
      this.durationEditElement.addEventListener("keypress", (event) => {
        if (event.code === "Enter") {
          event.target.blur();
        }
      });
      this.durationEditElement.addEventListener("blur", () => {
        const minutes = parseInt(this.durationEditElement.value);
        if (
          typeof minutes !== "number" ||
          isNaN(minutes) ||
          minutes <= 0 ||
          minutes > 10 * 60
        ) {
          alert("Duration must be between 1 and 10*60 minutes");
        } else {
          sendMessage({
            UpdateDuration: {
              talk_id: this.id,
              duration: {
                secs: minutes * 60,
                nanos: 0,
              },
            },
          });
        }
        this.element.replaceChild(
          this.durationElement,
          this.durationEditElement
        );
      });
    }

    this.descriptionElement = this.element.appendChild(
      document.createElement("div")
    );
    this.descriptionElement.classList.add("description");
    this.descriptionElement.innerText = this.description;
    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      this.descriptionElement.classList.add("editable");
      this.descriptionElement.addEventListener("click", () => {
        this.descriptionEditElement.value = this.description;
        this.element.replaceChild(
          this.descriptionEditElement,
          this.descriptionElement
        );
        this.descriptionEditElement.focus();
      });

      this.descriptionEditElement = document.createElement("textarea");
      this.descriptionEditElement.classList.add("description");
      this.descriptionEditElement.rows = 4;
      this.descriptionEditElement.addEventListener("input", () => {
        sendMessage({
          UpdateDescription: {
            talk_id: this.id,
            description: this.descriptionEditElement.value,
          },
        });
      });
      this.descriptionEditElement.addEventListener("blur", () => {
        this.element.replaceChild(
          this.descriptionElement,
          this.descriptionEditElement
        );
      });
    }

    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      this.titleEditElement.addEventListener("keydown", (event) => {
        if (event.code === "Tab") {
          event.preventDefault();
          event.target.blur();
          if (!event.shiftKey) {
            if (this.roles.includes("Scheduler")) {
              this.scheduledAtElement.click();
            } else {
              this.durationElement.click();
            }
          }
        } else if (event.code === "Enter" || event.code === "Escape") {
          event.target.blur();
        }
      });
      this.durationEditElement.addEventListener("keydown", (event) => {
        if (event.code === "Tab") {
          event.preventDefault();
          event.target.blur();
          if (event.shiftKey) {
            if (this.roles.includes("Scheduler")) {
              this.scheduledAtElement.click();
            } else {
              this.titleElement.click();
            }
          } else {
            this.descriptionElement.click();
          }
        } else if (event.code === "Enter" || event.code === "Escape") {
          event.target.blur();
        }
      });
      this.descriptionEditElement.addEventListener("keydown", (event) => {
        if (event.code === "Tab") {
          event.preventDefault();
          event.target.blur();
          if (event.shiftKey) {
            this.durationElement.click();
          }
        } else if (event.code === "Enter" || event.code === "Escape") {
          event.target.blur();
        }
      });
    }
    if (this.roles.includes("Scheduler")) {
      this.scheduledAtEditElement.addEventListener("keydown", (event) => {
        if (event.code === "Tab") {
          event.preventDefault();
          event.target.blur();
          if (event.shiftKey) {
            this.titleElement.click();
          } else {
            if (
              this.roles.includes("Editor") ||
              this.creator === this.currentUserId
            ) {
              this.durationElement.click();
            }
          }
        } else if (event.code === "Enter" || event.code === "Escape") {
          event.target.blur();
        }
      });
    }

    const operationElement = this.element.appendChild(
      document.createElement("div")
    );
    operationElement.classList.add("operation");

    this.noobsButtonElement = operationElement.appendChild(
      document.createElement("button")
    );
    this.noobsButtonElement.classList.add("noob");
    this.noobsButtonElement.innerText = "Noob";
    this.noobsButtonElement.addEventListener("click", () => {
      if (this.nerds.includes(this.currentUserId)) {
        sendMessage({
          RemoveNerd: {
            talk_id: this.id,
            user_id: currentUserId,
          },
        });
      }
      sendMessage({
        [this.noobs.includes(this.currentUserId) ? "RemoveNoob" : "AddNoob"]: {
          talk_id: this.id,
          user_id: currentUserId,
        },
      });
    });

    this.nerdsButtonElement = operationElement.appendChild(
      document.createElement("button")
    );
    this.nerdsButtonElement.classList.add("nerd");
    this.nerdsButtonElement.innerText = "Nerd";
    this.nerdsButtonElement.addEventListener("click", () => {
      if (this.noobs.includes(this.currentUserId)) {
        sendMessage({
          RemoveNoob: {
            talk_id: this.id,
            user_id: currentUserId,
          },
        });
      }
      sendMessage({
        [this.nerds.includes(this.currentUserId) ? "RemoveNerd" : "AddNerd"]: {
          talk_id: this.id,
          user_id: currentUserId,
        },
      });
    });
    this.updateParticipation();
  }

  minuteTick() {
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    this.durationElement.innerText = this.generateDuration();
  }

  getTargetSectionName() {
    if (this.scheduledAt !== null) {
      const beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      const endMinutes = Math.floor(
        (this.scheduledAt.secs_since_epoch + this.duration.secs) / 60
      );
      const nowMinutes = Math.floor(Date.now() / 60000);

      if (nowMinutes >= endMinutes) {
        return "past";
      } else if (nowMinutes < endMinutes && nowMinutes >= beginMinutes) {
        return "current";
      } else if (nowMinutes < beginMinutes) {
        return "upcoming";
      }
    }

    return "unscheduled";
  }

  updateUsers(users) {
    this.users = users;
    this.updateParticipation();
  }

  updateTitle(title) {
    this.title = title;
    this.titleElement.innerText = this.title;
  }

  updateDescription(description) {
    this.description = description;
    this.descriptionElement.innerText = this.description;
  }

  updateScheduledAt(scheduledAt) {
    this.scheduledAt = scheduledAt;
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    this.durationElement.innerText = this.generateDuration();
  }

  updateDuration(duration) {
    this.duration = duration;
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    this.durationElement.innerText = this.generateDuration();
  }

  addNoob(userId) {
    this.noobs.push(userId);
    this.updateParticipation();
  }

  removeNoob(userId) {
    this.noobs = this.noobs.filter((noob) => noob !== userId);
    this.updateParticipation();
  }

  addNerd(userId) {
    this.nerds.push(userId);
    this.updateParticipation();
  }

  removeNerd(userId) {
    this.nerds = this.nerds.filter((nerd) => nerd !== userId);
    this.updateParticipation();
  }

  generateScheduledAt() {
    if (this.scheduledAt !== null) {
      const beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      const beginDate = new Date(beginMinutes * 60000);
      const durationMinutes = Math.floor(this.duration.secs / 60);
      const nowMinutes = Math.floor(Date.now() / 60000);
      let relativeSuffix = "";
      if (
        nowMinutes < beginMinutes &&
        beginMinutes - nowMinutes <= durationMinutes
      ) {
        relativeSuffix = `\u00a0\u00a0(in ${beginMinutes - nowMinutes} minute${
          beginMinutes - nowMinutes === 1 ? "" : "s"
        })`;
      } else if (beginMinutes == nowMinutes) {
        relativeSuffix = "\u00a0\u00a0(now)";
      } else if (
        beginMinutes <= nowMinutes &&
        nowMinutes - beginMinutes < durationMinutes
      ) {
        relativeSuffix = `\u00a0\u00a0(${nowMinutes - beginMinutes} minute${
          nowMinutes - beginMinutes === 1 ? "" : "s"
        } ago)`;
      }
      return `at\u00a0\u00a0${beginDate.getFullYear()}-${(
        beginDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${beginDate
        .getDate()
        .toString()
        .padStart(2, "0")}\u00a0\u00a0${beginDate
        .getHours()
        .toString()
        .padStart(2, "0")}:${beginDate
        .getMinutes()
        .toString()
        .padStart(2, "0")}${relativeSuffix}`;
    }

    return "unscheduled";
  }

  updateScheduledAtElement() {
    const scheduledAtString = this.generateScheduledAt();
    if (scheduledAtString !== this.scheduledAtElement.innerText) {
      this.scheduledAtElement.innerText = scheduledAtString;
    }
  }

  generateDuration() {
    const durationMinutes = Math.floor(this.duration.secs / 60);
    let relativeSuffix = "";
    if (this.scheduledAt !== null) {
      const beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      const nowMinutes = Math.floor(Date.now() / 60000);
      if (
        beginMinutes <= nowMinutes &&
        nowMinutes - beginMinutes < durationMinutes
      ) {
        const leftMinutes = durationMinutes - (nowMinutes - beginMinutes);
        relativeSuffix = `\u00a0\u00a0(${leftMinutes} minute${
          leftMinutes === 1 ? "" : "s"
        } left)`;
      }
    }

    return `for\u00a0\u00a0${durationMinutes} minute${
      durationMinutes === 1 ? "" : "s"
    }${relativeSuffix}`;
  }

  updateDurationElement() {
    const durationString = this.generateDuration();
    if (durationString !== this.durationElement.innerText) {
      this.durationElement.innerText = durationString;
    }
  }

  updateParticipation() {
    const participatingAsNoob = this.noobs.includes(this.currentUserId);
    const participatingAsNerd = this.nerds.includes(this.currentUserId);
    if (participatingAsNoob) {
      this.noobsButtonElement.classList.add("participating");
    } else {
      this.noobsButtonElement.classList.remove("participating");
    }
    this.noobsButtonElement.innerText = `Noob (${this.noobs.length})`;
    this.noobsButtonElement.title = `${this.noobs
      .map(
        (userId) => `${this.users[userId].name} (${this.users[userId].team})`
      )
      .join(", ")}`;
    if (participatingAsNerd) {
      this.nerdsButtonElement.classList.add("participating");
    } else {
      this.nerdsButtonElement.classList.remove("participating");
    }
    this.nerdsButtonElement.innerText = `Nerd (${this.nerds.length})`;
    this.nerdsButtonElement.title = `${this.nerds
      .map(
        (userId) => `${this.users[userId].name} (${this.users[userId].team})`
      )
      .join(", ")}`;
    if (participatingAsNoob || participatingAsNerd) {
      this.element.classList.add("participating");
    } else {
      this.element.classList.remove("participating");
    }
  }
}

while (document.body.firstChild) {
  document.body.removeChild(document.body.firstChild);
}

const mopad = new Mopad(document.body);

setTimeout(() => {
  mopad.minuteTick();
  setInterval(() => {
    mopad.minuteTick();
  }, 60000);
}, (60 - new Date().getSeconds()) * 1000);

let reloginInterval = null;
const triggerRelogin = () => {
  if (document.visibilityState === "visible") {
    mopad.tryRelogin();
    reloginInterval = setInterval(() => {
      mopad.tryRelogin();
    }, 10000);
  } else {
    clearInterval(reloginInterval);
  }
};
triggerRelogin();
document.addEventListener("visibilitychange", triggerRelogin);
