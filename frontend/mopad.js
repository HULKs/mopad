// TODO: Add/remove talks
// TODO: styling
// TODO: Login/Reconnection/Persistence/Robustness

class Mopad {
  constructor(root) {
    this.root = root;

    this.loading = new Loading();
    this.login = new Login(
      (name, team, password) => {
        this.login.disable();
        this.connectWebSocket("Login", name, team, password);
      },
      () => {
        this.root.removeChild(this.login.element);
        this.root.appendChild(this.register.element);
        this.root.classList.add("center");
      }
    );
    this.register = new Register(
      (name, team, password) => {
        this.register.disable();
        this.connectWebSocket("Register", name, team, password);
      },
      () => {
        this.root.removeChild(this.register.element);
        this.root.appendChild(this.login.element);
        this.root.classList.add("center");
      }
    );
    this.talks = new Talks((message) => {
      this.webSocket.send(JSON.stringify(message));
    });

    this.root.appendChild(this.loading.element);
    this.root.classList.add("center");

    // this.retrieveTeams();
  }

  async retrieveTeams() {
    const teamsResponse = await fetch("/teams.json");
    const teams = await teamsResponse.json();

    this.login.updateTeams(teams);
    this.register.updateTeams(teams);

    this.root.removeChild(this.loading.element);
    this.root.appendChild(this.login.element);
    this.root.classList.add("center");
  }

  connectWebSocket(authenticationCommand, name, team, password) {
    this.socketReceivedError = false;
    this.webSocket = new WebSocket(
      `ws${window.location.protocol === "https:" ? "s" : ""}://${
        window.location.host
      }/api`
    );
    this.webSocket.addEventListener("open", () => {
      this.webSocket.send(
        JSON.stringify({
          [authenticationCommand]: {
            name,
            team,
            password,
          },
        })
      );
    });
    this.webSocket.addEventListener("close", () => {
      this.login.enable();
      this.register.enable();
      if (!this.socketReceivedError) {
        if (authenticationCommand === "Register") {
          this.root.removeChild(this.register.element);
        } else {
          this.root.removeChild(this.talks.element); // TODO: this errors because this.talks.element is not a child when getting AuthenticationError for Login
        }
        this.root.appendChild(this.login.element);
        this.root.classList.add("center");
      }
      this.webSocket = null;
    });
    this.webSocket.addEventListener("message", (event) => {
      let message = JSON.parse(event.data);
      if (message["AuthenticationSuccess"] !== undefined) {
        this.talks.setCurrentUserIdAndRoles(
          message["AuthenticationSuccess"]["user_id"],
          message["AuthenticationSuccess"]["roles"]
        );
        this.login.enable();
        this.register.enable();
        this.root.removeChild(
          authenticationCommand === "Login"
            ? this.login.element
            : this.register.element
        );
        this.root.appendChild(this.talks.element);
        this.root.classList.remove("center");
      } else if (message["AuthenticationError"] !== undefined) {
        alert(
          `Chestboard reported that we cannot ${
            authenticationCommand === "Login" ? "log" : "register"
          } you ${authenticationCommand === "Login" ? "in" : ""} (${
            message["AuthenticationError"]["reason"]
          })`
        );
        this.login.element.enable();
        this.register.element.enable();
        this.socketReceivedError = true;
      } else if (message["Users"] !== undefined) {
        this.talks.updateUsers(message["Users"]["users"]);
      } else if (message["AddTalk"] !== undefined) {
        this.talks.addTalk(message["AddTalk"]["talk"]);
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

    const centeredBoxElement = this.element.appendChild(
      document.createElement("div")
    );
    centeredBoxElement.classList.add("centered-box");

    const heading1Element = centeredBoxElement.appendChild(
      document.createElement("h1")
    );
    heading1Element.innerText = "MOPAD";

    const heading2Element = centeredBoxElement.appendChild(
      document.createElement("h2")
    );
    heading2Element.innerText =
      "Moderated Organization PAD (powerful, agile, distributed)";

    const heading3Element = centeredBoxElement.appendChild(
      document.createElement("h3")
    );
    heading3Element.innerText = "Login";

    this.nameElement = centeredBoxElement.appendChild(
      document.createElement("input")
    );
    this.nameElement.type = "text";
    this.nameElement.placeholder = "Your Name";

    this.teamElement = centeredBoxElement.appendChild(
      document.createElement("select")
    );

    this.passwordElement = centeredBoxElement.appendChild(
      document.createElement("input")
    );
    this.passwordElement.type = "password";
    this.passwordElement.placeholder = "Your Password";

    this.buttonElement = centeredBoxElement.appendChild(
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

    const noAccountElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    noAccountElement.classList.add("login-register-switcher");

    noAccountElement.appendChild(
      document.createTextNode("Don't have an account? ")
    );

    const switchToRegisterElement = noAccountElement.appendChild(
      document.createElement("a")
    );
    switchToRegisterElement.href = "#";
    switchToRegisterElement.innerText = "Register";
    switchToRegisterElement.addEventListener("click", (event) => {
      event.preventDefault();
      switchToRegister();
    });

    const footerElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    footerElement.classList.add("footer");
    footerElement.innerText =
      "Imprint/Impressum - Privacy Policy/Datenschutzerklärung";
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

    const centeredBoxElement = this.element.appendChild(
      document.createElement("div")
    );
    centeredBoxElement.classList.add("centered-box");

    const heading1Element = centeredBoxElement.appendChild(
      document.createElement("h1")
    );
    heading1Element.innerText = "MOPAD";

    const heading2Element = centeredBoxElement.appendChild(
      document.createElement("h2")
    );
    heading2Element.innerText =
      "Moderated Organization PAD (powerful, agile, distributed)";

    const heading3Element = centeredBoxElement.appendChild(
      document.createElement("h3")
    );
    heading3Element.innerText = "Register";

    this.nameElement = centeredBoxElement.appendChild(
      document.createElement("input")
    );
    this.nameElement.type = "text";
    this.nameElement.placeholder = "Your Name";

    const nameHintElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    nameHintElement.classList.add("hint");
    nameHintElement.innerText = "Unique in your team, visible to everyone";

    this.teamElement = centeredBoxElement.appendChild(
      document.createElement("select")
    );

    const teamHintElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    teamHintElement.classList.add("hint");
    teamHintElement.innerText = "Visible to everyone";

    this.passwordElement = centeredBoxElement.appendChild(
      document.createElement("input")
    );
    this.passwordElement.type = "password";
    this.passwordElement.placeholder = "Your Password";

    this.iAmNotANaoElement = centeredBoxElement.appendChild(
      document.createElement("input")
    );
    this.iAmNotANaoElement.type = "checkbox";
    this.iAmNotANaoElement.id = "i-am-not-a-nao";

    const iAmNotANaoLabelElement = centeredBoxElement.appendChild(
      document.createElement("label")
    );
    iAmNotANaoLabelElement.setAttribute("for", "i-am-not-a-nao");
    iAmNotANaoLabelElement.innerText = "I'm not a NAO";

    this.buttonElement = centeredBoxElement.appendChild(
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

    const noAccountElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    noAccountElement.classList.add("login-register-switcher");

    noAccountElement.appendChild(
      document.createTextNode("Already have an account? ")
    );

    const switchToLoginElement = noAccountElement.appendChild(
      document.createElement("a")
    );
    switchToLoginElement.href = "#";
    switchToLoginElement.innerText = "Login";
    switchToLoginElement.addEventListener("click", (event) => {
      event.preventDefault();
      switchToLogin();
    });

    const footerElement = centeredBoxElement.appendChild(
      document.createElement("div")
    );
    footerElement.classList.add("footer");
    footerElement.innerText =
      "Imprint/Impressum - Privacy Policy/Datenschutzerklärung";
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
  constructor(sendMessage) {
    this.element = document.createElement("div");
    this.element.id = "talks";

    this.sendMessage = sendMessage;

    this.talks = {};
    this.sectionElementsOfTalks = {};
    this.users = {};

    const headingElement = this.element.appendChild(
      document.createElement("h1")
    );
    headingElement.innerText = "MOPAD";

    const pastDetailsElement = this.element.appendChild(
      document.createElement("details")
    );

    const pastSummaryElement = pastDetailsElement.appendChild(
      document.createElement("summary")
    );
    pastSummaryElement.innerText = "Past talks";

    this.pastTalksElement = pastDetailsElement.appendChild(
      document.createElement("div")
    );
    this.pastTalksElement.classList.add("talks");

    const currentDetailsElement = this.element.appendChild(
      document.createElement("details")
    );
    currentDetailsElement.open = true;

    const currentSummaryElement = currentDetailsElement.appendChild(
      document.createElement("summary")
    );
    currentSummaryElement.innerText = "Current talks";

    this.currentTalksElement = currentDetailsElement.appendChild(
      document.createElement("div")
    );
    this.currentTalksElement.classList.add("talks");

    const upcomingDetailsElement = this.element.appendChild(
      document.createElement("details")
    );
    upcomingDetailsElement.open = true;

    const upcomingSummaryElement = upcomingDetailsElement.appendChild(
      document.createElement("summary")
    );
    upcomingSummaryElement.innerText = "Upcoming talks";

    this.upcomingTalksElement = upcomingDetailsElement.appendChild(
      document.createElement("div")
    );
    this.upcomingTalksElement.classList.add("talks");

    const unscheduledDetailsElement = this.element.appendChild(
      document.createElement("details")
    );
    unscheduledDetailsElement.open = true;

    const unscheduledSummaryElement = unscheduledDetailsElement.appendChild(
      document.createElement("summary")
    );
    unscheduledSummaryElement.innerText = "Unscheduled talks";

    this.unscheduledTalksElement = unscheduledDetailsElement.appendChild(
      document.createElement("div")
    );
    this.unscheduledTalksElement.classList.add("talks");
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
  }

  setCurrentUserIdAndRoles(currentUserId, roles) {
    this.currentUserId = currentUserId;
    this.roles = roles;
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
      ) =>
        this.talks[leftTalkId].scheduledAt.secs_since_epoch -
        this.talks[rightTalkId].scheduledAt.secs_since_epoch
    );
    const talkOfLaterScheduledAt = otherTalksInSection.find(
      ([otherTalkId, _sectionElement]) =>
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
  }

  removeTalk(talkId) {
    this.sectionElementsOfTalks[talkId].removeChild(this.talks[talkId].element);
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

    this.titleElement = this.element.appendChild(document.createElement("h1"));
    this.titleElement.innerText = this.title;
    if (this.roles.includes("Editor") || this.creator === this.currentUserId) {
      this.titleElement.classList.add("editable");
      this.titleElement.addEventListener("click", () => {
        this.titleEditElement.value = this.title;
        this.element.replaceChild(this.titleEditElement, this.titleElement);
        this.titleEditElement.focus();
      });

      this.titleEditElement = document.createElement("input");
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

    this.descriptionElement = this.element.appendChild(
      document.createElement("div")
    );
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

      this.descriptionEditElement = document.createElement("input");
      this.descriptionEditElement.type = "text";
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

    this.scheduledAtElement = this.element.appendChild(
      document.createElement("div")
    );
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    if (this.roles.includes("Scheduler")) {
      this.scheduledAtElement.classList.add("editable");
      this.scheduledAtElement.addEventListener("click", () => {
        if (this.scheduledAt) {
          let beginDate = new Date(this.scheduledAt.secs_since_epoch * 1000);
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
      this.durationEditElement.type = "number";
      this.durationEditElement.min = 1;
      this.durationEditElement.max = 600;
      this.durationEditElement.addEventListener("blur", () => {
        sendMessage({
          UpdateDuration: {
            talk_id: this.id,
            duration: {
              secs: parseInt(this.durationEditElement.value) * 60,
              nanos: 0,
            },
          },
        });
        this.element.replaceChild(
          this.durationElement,
          this.durationEditElement
        );
      });
    }

    this.noobsElement = this.element.appendChild(document.createElement("div"));
    this.noobsCheckboxElement = this.noobsElement.appendChild(
      document.createElement("input")
    );
    this.noobsCheckboxElement.id = `talk-${this.id}-noobs-checkbox`;
    this.noobsCheckboxElement.type = "checkbox";
    this.noobsCheckboxElement.addEventListener("change", () => {
      sendMessage({
        [this.noobsCheckboxElement.checked ? "AddNoob" : "RemoveNoob"]: {
          talk_id: this.id,
          user_id: currentUserId,
        },
      });
    });
    this.noobsLabelElement = this.noobsElement.appendChild(
      document.createElement("label")
    );
    this.noobsLabelElement.setAttribute(
      "for",
      `talk-${this.id}-noobs-checkbox`
    );
    this.noobsLabelElement.innerText = "Noobs";
    this.noobsListElement = this.noobsElement.appendChild(
      document.createElement("div")
    );
    this.updateNoobs();

    this.nerdsElement = this.element.appendChild(document.createElement("div"));
    this.nerdsCheckboxElement = this.nerdsElement.appendChild(
      document.createElement("input")
    );
    this.nerdsCheckboxElement.id = `talk-${this.id}-nerds-checkbox`;
    this.nerdsCheckboxElement.type = "checkbox";
    this.nerdsCheckboxElement.addEventListener("change", () => {
      sendMessage({
        [this.nerdsCheckboxElement.checked ? "AddNerd" : "RemoveNerd"]: {
          talk_id: this.id,
          user_id: currentUserId,
        },
      });
    });
    this.nerdsLabelElement = this.nerdsElement.appendChild(
      document.createElement("label")
    );
    this.nerdsLabelElement.setAttribute(
      "for",
      `talk-${this.id}-nerds-checkbox`
    );
    this.nerdsLabelElement.innerText = "Nerds";
    this.nerdsListElement = this.nerdsElement.appendChild(
      document.createElement("div")
    );
    this.updateNerds();
  }

  minuteTick() {
    this.scheduledAtElement.innerText = this.generateScheduledAt();
    this.durationElement.innerText = this.generateDuration();
  }

  getTargetSectionName() {
    if (this.scheduledAt !== null) {
      let beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      let endMinutes = Math.floor(
        (this.scheduledAt.secs_since_epoch + this.duration.secs) / 60
      );
      let nowMinutes = Math.floor(Date.now() / 60000);

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
    this.updateNoobs();
    this.updateNerds();
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
    this.updateNoobs();
  }

  removeNoob(userId) {
    this.noobs = this.noobs.filter((noob) => noob !== userId);
    this.updateNoobs();
  }

  addNerd(userId) {
    this.nerds.push(userId);
    this.updateNerds();
  }

  removeNerd(userId) {
    this.nerds = this.nerds.filter((nerd) => nerd !== userId);
    this.updateNerds();
  }

  generateScheduledAt() {
    if (this.scheduledAt !== null) {
      let beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      let beginDate = new Date(beginMinutes * 60000);
      let durationMinutes = Math.floor(this.duration.secs / 60);
      let nowMinutes = Math.floor(Date.now() / 60000);
      let relativeSuffix = "";
      if (
        nowMinutes < beginMinutes &&
        beginMinutes - nowMinutes <= durationMinutes
      ) {
        relativeSuffix = ` (in ${beginMinutes - nowMinutes} minute${
          beginMinutes - nowMinutes === 1 ? "" : "s"
        })`;
      } else if (beginMinutes == nowMinutes) {
        relativeSuffix = " (now)";
      } else if (
        beginMinutes <= nowMinutes &&
        nowMinutes - beginMinutes < durationMinutes
      ) {
        relativeSuffix = ` (${nowMinutes - beginMinutes} minute${
          nowMinutes - beginMinutes === 1 ? "" : "s"
        } ago)`;
      }
      return `at ${beginDate.getFullYear()}-${(beginDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${beginDate
        .getDate()
        .toString()
        .padStart(2, "0")} ${beginDate
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
    let scheduledAtString = this.generateScheduledAt();
    if (scheduledAtString !== this.scheduledAtElement.innerText) {
      this.scheduledAtElement.innerText = scheduledAtString;
    }
  }

  generateDuration() {
    let durationMinutes = Math.floor(this.duration.secs / 60);
    let relativeSuffix = "";
    if (this.scheduledAt !== null) {
      let beginMinutes = Math.floor(this.scheduledAt.secs_since_epoch / 60);
      let nowMinutes = Math.floor(Date.now() / 60000);
      if (
        beginMinutes <= nowMinutes &&
        nowMinutes - beginMinutes < durationMinutes
      ) {
        let leftMinutes = durationMinutes - (nowMinutes - beginMinutes);
        relativeSuffix = ` (${leftMinutes} minute${
          leftMinutes === 1 ? "" : "s"
        } left)`;
      }
    }

    return `for ${durationMinutes} minute${
      durationMinutes === 1 ? "" : "s"
    }${relativeSuffix}`;
  }

  updateDurationElement() {
    let durationString = this.generateDuration();
    if (durationString !== this.durationElement.innerText) {
      this.durationElement.innerText = durationString;
    }
  }

  updateNoobs() {
    this.noobsCheckboxElement.checked = this.noobs.includes(this.currentUserId);

    this.noobsLabelElement.innerText = `${this.noobs.length} Noob${
      this.noobs.length == 1 ? "" : "s"
    }${this.noobs.length > 0 ? ":" : ""}`;

    while (this.noobsListElement.firstChild) {
      this.noobsListElement.removeChild(this.noobsListElement.firstChild);
    }

    for (let userId of this.noobs) {
      let noobElement = this.noobsListElement.appendChild(
        document.createElement(userId == this.currentUserId ? "b" : "span")
      );
      noobElement.innerText = this.users[userId].name;
      noobElement.title = this.users[userId].team;
    }
  }

  updateNerds() {
    this.nerdsCheckboxElement.checked = this.nerds.includes(this.currentUserId);

    this.nerdsLabelElement.innerText = `${this.nerds.length} Nerd${
      this.nerds.length == 1 ? "" : "s"
    }${this.nerds.length > 0 ? ":" : ""}`;

    while (this.nerdsListElement.firstChild) {
      this.nerdsListElement.removeChild(this.nerdsListElement.firstChild);
    }

    for (let userId of this.nerds) {
      let nerdElement = this.nerdsListElement.appendChild(
        document.createElement(userId == this.currentUserId ? "b" : "span")
      );
      nerdElement.innerText = this.users[userId].name;
      nerdElement.title = this.users[userId].team;
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
