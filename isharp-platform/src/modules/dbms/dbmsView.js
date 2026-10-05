/**
 * iSHARP DBMS 2.0 — DBMS View Controller
 * Responsible for rendering the DBMS command shell, sidebar, tabs, and modals into #view-dbms.
 */

import { getDbmsShellHtml } from "./templates/dbmsShellTemplate.js";

export class DbmsView {
    constructor(containerId = "view-dbms") {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.innerHTML = getDbmsShellHtml();
    }
}
