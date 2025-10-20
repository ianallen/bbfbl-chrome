import * as $ from 'jquery';
import salariesLocal from './salaries';
import * as _ from 'lodash';
import "jquery-ui/ui/widgets/autocomplete";

// Constants
const MAX_SALARY_CUTOFF = 201500000;
const SALARY_FILTER_DEFAULT = 75;
const RENDER_INTERVAL_MS = 500;
const DEBOUNCE_DELAY_MS = 1000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Games Played Constants (from league rules)
const MIN_GAMES_PLAYED = 730; // Minimum games required (Competitive Balance)
const MAX_GAMES_PER_POSITION = 80; // Max games per position
const MAX_ACTIVE_POSITIONS = 10; // Active player positions
const MAX_TOTAL_GAMES = MAX_GAMES_PER_POSITION * MAX_ACTIVE_POSITIONS; // 800 total games

// DOM Selectors
const SELECTORS = {
    PLAYER: '.ysf-player-name',
    SALARY_FILTER_CONTAINER: '.js-salary-filter-container',
    SALARY_FILTER_INPUT: '.js-salary-filter',
    SALARY_TOOL_CONTAINER: '.js-salary-tool-container',
    SALARY_TOOL: '.salary-tool',
    TEAM_CARD_STATS: '#team-card .team-card-stats',
    PLAYER_FILTER_SELECTS: '#playerfilter .selects',
    PLAYERS_TABLE: '.players tr',
    GAMES_PLAYED_CELL: 'td[data-stat="gp"]', // Games played column
    TEAM_PAGE: '.team-page', // Team page identifier
    ROSTER_TABLE: '.roster-table, .players-table', // Roster/players table
    MAX_GAMES_TABLE: '#position-caps-roto table', // Maximum games table
    MAX_GAMES_PLAYED_CELL: '#position-caps-roto table tbody tr td:nth-child(2)' // "Played" column cells
};

// URLs
const URLS = {
    SALARIES_CSV: 'https://docs.google.com/spreadsheets/d/1Z2Ui53FiZGP1sMSdjQP5q2i5o2sjVCl1OQUc648LKRs/export?format=csv',
    SALARIES_API: 'https://bbfbl-chrome.azurewebsites.net/salaries-zsc'
};

// Storage Keys
const STORAGE_KEYS = {
    SALARIES: 'bbfblSalaries_xu',
    CACHE_DATE: 'cacheDate',
    SALARY_FILTER: 'bbfbl-salary-filter'
};

// TypeScript Interfaces
interface PlayerSalary {
    name: string;
    salary24_25: number;
    salary25_26: number;
    salary26_27: number;
    salary27_28: number;
    yahoo_id: number;
}

interface AutocompleteItem {
    label: string;
    value: string;
    id: number;
    salary24_25: number;
    salary25_26: number;
    salary26_27: number;
    salary27_28: number;
    salares: number[];
}

interface PageState {
    canDisplaySalaries: boolean | null;
    canDisplayTool: boolean | null;
    url: string;
}

// Utility Functions
class Utils {
    static toDollarFormat(value: number | string): string {
        if (!value) return "-";
        if (value === '???') return value as string;
        
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        });
        return formatter.format(Number(value));
    }

    static getId(href: string): number {
        const fragments = href.split('/');
        return parseInt(fragments[fragments.length - 1]);
    }

    static sum(values: number[]): number {
        return values.reduce((total, salary) => total + salary, 0);
    }

    static isExpired(timestamp: number): boolean {
        const now = new Date().getTime();
        return now - timestamp > CACHE_TTL_MS;
    }

    static getHref(element: Element): string | undefined {
        const $el = $(element);
        return $el.find('a').attr('href');
    }

    static isPlayerElement(element: Element): boolean {
        const href = this.getHref(element);
        return href != null;
    }
}

// Page Detection Utilities
class PageDetector {
    static isPlayerListPage(): boolean {
        return window.location.pathname.indexOf("/players") > 0;
    }

    static isResearchPage(): boolean {
        return window.location.pathname.indexOf("/buzzindex") > 0 || 
               window.location.pathname.indexOf("/research") > 0;
    }

    static isPlayerPage(): boolean {
        return !isNaN(parseInt(window.location.pathname.split("/")[3], 10));
    }

    static isTeamPage(): boolean {
        return window.location.pathname.indexOf("/team") > 0 || 
               $(SELECTORS.TEAM_PAGE).length > 0 ||
               $(SELECTORS.ROSTER_TABLE).length > 0 ||
               $(SELECTORS.MAX_GAMES_TABLE).length > 0; // Maximum Games table indicates team page
    }
}

// Salary Renderer Class
class SalaryRenderer {
    static renderSalary(salary: number): JQuery<HTMLElement> {
        const css = {
            'color': '#0d8d40',
            'font-size': 10,
            'font-weight': 500
        };
        const $el = $(`<span class="bbfbl-salary">${Utils.toDollarFormat(salary)}</span>`);
        $el.css(css);
        return $el;
    }

    static renderTotalSalary(total: number) {
        const remaining = MAX_SALARY_CUTOFF - total;
        const color = total < MAX_SALARY_CUTOFF ? '#0d8d40' : '#f33131';
        const css = {
            'color': color,
            'font-size': 10,
            'font-weight': 500
        };
        
        const elem = $(`<li class="Inlineblock Mend-lg Ta-c">
            <span class="Fw-b Fz-35">${Utils.toDollarFormat(total)}</span>
            <em class="Block F-shade Fz-xs">Total Salary - (${Utils.toDollarFormat(remaining)} available)</em>
        </li>`);
        elem.css(css);

        $(SELECTORS.TEAM_CARD_STATS).append(elem);
    }
}

// Salary Filter Class
class SalaryFilter {
    static renderFilterInput() {
        if ($(SELECTORS.SALARY_FILTER_CONTAINER).length > 0) {
            return;
        }
        const template = $(`
            <div class="Grid-u Mend-med js-salary-filter-container" style="margin-left: 20px;">
                <label for="bbfbl-salary" class="Control-label No-p">Max Salary</label>
                <input class="js-salary-filter Input Input-med" type="number" maxlength="3" min="0" style="width:45px;margin-right:10px;" placeholder="In Millions" />Million
            </div>
        `);
        const anchor = $(SELECTORS.PLAYER_FILTER_SELECTS);
        anchor.append(template);
    }

    static setupFiltering() {
        console.log("setting up filters");
        const maxSalary = this.getFilterValue();
        this.saveState(maxSalary);
        this.filterPlayers(maxSalary);

        const filter = $(SELECTORS.SALARY_FILTER_INPUT);
        filter.on("keyup change", _.debounce(this.onFilterChange, DEBOUNCE_DELAY_MS));
        filter.val(maxSalary);
        $(window).on("popstate", function() {});
    }

    static onFilterChange() {
        const value = $(this).val() as string;
        let max = parseInt(value);
        if (!max) {
            max = 50;
        }
        
        this.filterPlayers(max);
        this.saveState(max);
    }

    static filterPlayers(maxSalary: number) {
        const players = $(SELECTORS.PLAYERS_TABLE);
        players.show();
        players.filter(function () {
            const salary = $(this).find(SELECTORS.PLAYER).data("bbfbl-salary");
            return salary / 1000000 >= maxSalary;
        }).hide();
    }

    static saveState(value: number) {
        const url = new URL(window.location.href);
        url.searchParams.set("maxSalary", value.toString());
        window.history.pushState({}, '', url.href);
        chrome.storage.local.set({[STORAGE_KEYS.SALARY_FILTER]: value}, function() {});
    }

    static getFilterValue(): number {
        const params = new URLSearchParams(window.location.search);
        const maxSalary = params.get("maxSalary");
        chrome.storage.local.get("bbfbl", function() {});
        if (!maxSalary) {
            return SALARY_FILTER_DEFAULT;
        }
        return parseInt(maxSalary);
    }
}

// Salary Tool Class
class SalaryTool {
    static setupContainer() {
        const toolContainer = $('<div class="js-salary-tool-container salary-tool arrow box"></div>');
        const toolAnchor = $("header.Bdrbot");
        toolContainer.insertAfter(toolAnchor);
        return toolContainer;
    }

    static onTriggerClick(e: JQuery.Event) {
        $(e.target).toggleClass("active");
        const toolContainer = $(SELECTORS.SALARY_TOOL);
        toolContainer.toggleClass("show");
    }

    static renderToolBody() {
        const contentContainer = $('<div class="tool-content ui-widget"></div>');
        let table = `
            <table>
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Salary 2024 - 2025</th>
                        <th>Salary 2025 - 2026</th>
                        <th>Salary 2026 - 2027</th> 
                        <th>Salary 2027 - 2028</th>              
                    </tr>
                </thead>
                <tbody>`;
        
        const $players = $(SELECTORS.PLAYER);
        for (let i = 0; i < $players.length; i++) { 
            const row = `<tr class="player-row player-row-${i}">
                            <td class="player-col"><input class="player-input player-${i}"></td>
                            <td class="salary salary-24"></td>
                            <td class="salary salary-25"></td>
                            <td class="salary salary-26"></td>
                            <td class="salary salary-27"></td>
                        </tr>`;
            table += row;
        }

        const footer = `</tbody>
                        <tfoot>
                            <tr>
                                <td class="salary-footer xt"><strong>Total</strong></td>
                                <td class="salary-footer salary-24-sum"></td>
                                <td class="salary-footer salary-25-sum"></td>
                                <td class="salary-footer salary-26-sum"></td>
                                <td class="salary-footer salary-27-sum"></td>
                            </tr>
                        </tfoot>
                        </table>`;
        table += footer;
        contentContainer.append(table);
        $(SELECTORS.SALARY_TOOL).append(contentContainer);
    }

    static setupAutoComplete() {
        const source: AutocompleteItem[] = bbfbl_salaries.map(s => ({
            label: s.name, 
            value: s.name, 
            id: s.yahoo_id, 
            salary24_25: s.salary24_25,
            salary25_26: s.salary25_26,
            salary26_27: s.salary26_27,
            salary27_28: s.salary27_28,
            salares: [s.salary24_25, s.salary25_26, s.salary26_27, s.salary27_28]
        }));
        
        $(".player-input").autocomplete({
            source: source,
            minLength: 2,
            select: function(event, ui) {
                const wrapper = this.generatePlayerWrapper(ui.item.label);
                const row = $(this).closest(".player-row");
                row.find(".player-col").append(wrapper);
                
                // Replace with static selection
                $(this).hide();
                row.find("td.salary").text("");
                row.find("td.salary")
                    .each(function(i, el) {
                        $(el).text(Utils.toDollarFormat(ui.item.salares[i]));
                        $(el).data("salary", ui.item.salares[i]);
                    });
                
                row.find(".cancel").addClass("active");
                
                // Need to recalc whenever new selection is made
                this.calculateSalaryForYear();
                // Reset raw selection
                $(this).val("");
                return false;
            }.bind(this)
        });
    }

    static calculateSalaryForYear() {
        const totals = [".salary-24", ".salary-25", ".salary-26", ".salary-27"];

        totals.forEach(function(year) {
            let sum = 0;
            $(year).each(function() {
                const salary = $(this).data("salary");
                if (salary) {
                    sum += salary;
                }
            });
            const sumEl = $(year + "-sum");
            sumEl.text(Utils.toDollarFormat(sum));
            if (sum > MAX_SALARY_CUTOFF) {
                sumEl.addClass("warning");
            } else {
                sumEl.removeClass("warning");
            }
        });
    }

    static setupCancelButton() {
        $(".player-col").on("click", ".cancel", function() {
            const row = $(this).closest(".player-row");
            row.hide();
            row.find("input").show();
            row.find("td.salary").text("").data("salary", 0);
            row.find(".player-display-wrap").remove();
            this.calculateSalaryForYear();
            row.show();
        }.bind(this));
    }

    static generatePlayerWrapper(label: string): JQuery<HTMLElement> {
        const wrapperClass = "player-display-wrap";        
        const wrapper = $(`<div><span>${label}</span><span class="cancel">x</span></div>`);
        wrapper.addClass(wrapperClass);
        return wrapper;
    }

    static prepopulateTool() {
        // Track index of players we find on the page
        let playerIdx = 0;
        $(SELECTORS.PLAYER).each(function(i) {
            if (!Utils.isPlayerElement(this)) {
                return;
            }
            // Update row for player
            const playerData = this.getPlayerSalaryInfo(this);
            if (!playerData) {
                console.log("Missing salary for:", this, playerData);
                return;
            }
            const row = $(".salary-tool .player-row").eq(playerIdx);
            row.find(".player-input").hide();
            
            const wrapper = this.generatePlayerWrapper(playerData.name);
            row.find(".player-col").append(wrapper);
            
            // Append salaries
            const salaries = [playerData.salary24_25, playerData.salary25_26, playerData.salary26_27, playerData.salary27_28];
            row.find("td.salary")
                .each(function(n, el) {
                    $(el).text(Utils.toDollarFormat(salaries[n]));
                    $(el).data("salary", salaries[n]);
                });
            row.find(".cancel").addClass("active");
            playerIdx++;
        }.bind(this));
        this.calculateSalaryForYear();
    }

    static getPlayerSalaryInfo(element: Element): PlayerSalary | undefined {
        const href = Utils.getHref(element);
        if (!href) return undefined;
        return _.find(bbfbl_salaries, { yahoo_id: Utils.getId(href) });
    }
}

// Games Played Tracker Class
class GamesPlayedTracker {
    static renderGamesPlayedIndicator() {
        if ($(".bbfbl-games-indicator").length > 0) {
            return; // Already rendered
        }

        const totalGames = this.calculateTotalGamesPlayed();
        const progress = this.calculateProgress(totalGames);
        
        const indicator = this.createGamesPlayedIndicator(totalGames, progress);
        $(SELECTORS.TEAM_CARD_STATS).append(indicator);
    }

    static calculateTotalGamesPlayed(): number {
        let totalGames = 0;
        
        // First try the Maximum Games table (most reliable)
        const $maxGamesTable = $(SELECTORS.MAX_GAMES_TABLE);
        if ($maxGamesTable.length > 0) {
            const $playedCells = $(SELECTORS.MAX_GAMES_PLAYED_CELL);
            $playedCells.each(function() {
                const gamesText = $(this).text().trim();
                const games = parseInt(gamesText);
                if (!isNaN(games)) {
                    totalGames += games;
                }
            });
            return totalGames;
        }
        
        // Fallback to other selectors if Maximum Games table not found
        const gamesSelectors = [
            'td[data-stat="gp"]', // Standard data-stat attribute
            'td:nth-child(3)', // Common position for games played
            '.gp', // Games played class
            'td[title*="games"]', // Title attribute containing "games"
            'td[title*="Games"]' // Case variation
        ];

        for (const selector of gamesSelectors) {
            const $gamesCells = $(selector);
            if ($gamesCells.length > 0) {
                $gamesCells.each(function() {
                    const gamesText = $(this).text().trim();
                    const games = parseInt(gamesText);
                    if (!isNaN(games)) {
                        totalGames += games;
                    }
                });
                break; // Use first successful selector
            }
        }

        return totalGames;
    }

    static calculateProgress(totalGames: number) {
        const minProgress = Math.min((totalGames / MIN_GAMES_PLAYED) * 100, 100);
        const maxProgress = Math.min((totalGames / MAX_TOTAL_GAMES) * 100, 100);
        
        return {
            minProgress,
            maxProgress,
            isAboveMin: totalGames >= MIN_GAMES_PLAYED,
            isNearMax: totalGames >= MAX_TOTAL_GAMES * 0.9, // 90% of max
            isAtMax: totalGames >= MAX_TOTAL_GAMES
        };
    }

    static createGamesPlayedIndicator(totalGames: number, progress: any): JQuery<HTMLElement> {
        const statusColor = progress.isAboveMin ? '#0d8d40' : '#f33131';
        const minPosition = (MIN_GAMES_PLAYED / MAX_TOTAL_GAMES) * 100; // Position of min line as percentage
        const currentPosition = (totalGames / MAX_TOTAL_GAMES) * 100; // Current position as percentage
        
        const indicator = $(`
            <li class="Inlineblock Mend-lg Ta-c bbfbl-games-indicator">
                <div class="games-progress-container" style="margin: 10px 0;">
                    <div class="games-stats" style="margin-bottom: 8px;">
                        <span class="Fw-b Fz-24" style="color: ${statusColor};">${totalGames}</span>
                        <em class="Block F-shade Fz-xs">Total Games Played</em>
                    </div>
                    <div class="progress-container" style="width: 200px; margin: 0 auto; position: relative;">
                        <div class="progress-bar" style="width: 100%; height: 12px; background: #e0e0e0; border-radius: 6px; overflow: hidden; position: relative;">
                            <div class="progress-fill" style="height: 100%; background: ${statusColor}; width: ${currentPosition}%; transition: width 0.3s ease;"></div>
                            <div class="min-line" style="position: absolute; left: ${minPosition}%; top: 0; width: 2px; height: 100%; background: #666; z-index: 2;"></div>
                        </div>
                        <div class="progress-labels" style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 4px;">
                            <span>Min: ${MIN_GAMES_PLAYED}</span>
                            <span>Max: ${MAX_TOTAL_GAMES}</span>
                        </div>
                    </div>
                </div>
            </li>
        `);

        return indicator;
    }

    static updateGamesPlayedIndicator() {
        const $indicator = $(".bbfbl-games-indicator");
        if ($indicator.length === 0) return;

        const totalGames = this.calculateTotalGamesPlayed();
        const progress = this.calculateProgress(totalGames);
        
        const statusColor = progress.isAboveMin ? '#0d8d40' : '#f33131';
        const currentPosition = (totalGames / MAX_TOTAL_GAMES) * 100;
        
        // Update the display
        $indicator.find('.games-stats .Fw-b').text(totalGames).css('color', statusColor);
        $indicator.find('.progress-fill').css({
            'width': currentPosition + '%',
            'background': statusColor
        });
    }
}

// Global state
let bbfbl_salaries: PlayerSalary[] = [];
$(async function() {
    console.log("BBFBL: Content script loaded");
    
    const pageState: PageState = {
        canDisplaySalaries: null,
        canDisplayTool: null,
        url: window.location.href
    };

    await fetchSalariesFromRemote();
    setInterval(() => renderBbfbl(pageState), RENDER_INTERVAL_MS);
    
    function renderBbfbl(pageState: PageState) {
        if ($("body").hasClass('bbfbl') && pageState.url === window.location.href) {
            return;
        }

        console.log("BBFBL: Attempting to render salaries...");

        if (shouldRenderSalaries()) {
            renderSalaries(pageState);
        }

        if (PageDetector.isPlayerListPage()) {
            SalaryFilter.renderFilterInput();
            SalaryFilter.setupFiltering();
        }

        if (PageDetector.isTeamPage()) {
            GamesPlayedTracker.renderGamesPlayedIndicator();
            // Update the indicator if it already exists
            GamesPlayedTracker.updateGamesPlayedIndicator();
        }
        
        $("body").addClass('bbfbl');
        pageState.url = window.location.href;
    }

    function shouldRenderSalaries() {
        let result = $(".bbfbl-salary").length
        console.log(result)
        return result == 0
    }

    function renderSalaries(pageState: PageState) {
        console.log("rendering salaries");
        
        if (pageState.canDisplaySalaries === null) {
            const isSalariesLoaded = !!bbfbl_salaries;
            const shouldDisplay = isSalariesLoaded && (
                PageDetector.isPlayerListPage() || 
                PageDetector.isResearchPage() || 
                PageDetector.isPlayerPage()
            );
            pageState.canDisplaySalaries = shouldDisplay;
        }

        if (!pageState.canDisplaySalaries) {
            return;
        }

        console.log("rendering bbfbl salary...");
        const $players = $(SELECTORS.PLAYER);
        const teamSalaries: number[] = [];

        $players.each(function() {
            const $this = $(this);
            const href = Utils.getHref(this);

            if (!href) {
                console.log(`BBFBL: No href found for player - ${$this.text()}`);
                return;
            }

            const playerData = _.find(bbfbl_salaries, { yahoo_id: Utils.getId(href) });
            const value = playerData ? playerData.salary25_26 : 0;
            
            $this.append(SalaryRenderer.renderSalary(value));
            $this.data("bbfbl-salary", value);
            $this.addClass('bbfbl-salaried');
            teamSalaries.push(value);
        });

        const hasSalaryDisplayed = $("#team-card-info .bbfbl-total-salary").length > 0;
        if (!hasSalaryDisplayed) {
            const totalSalary = Utils.sum(teamSalaries);
            SalaryRenderer.renderTotalSalary(totalSalary);
        }
        
        const width = window.location.href.indexOf('players') > 0 ? 230 : 255;
        $('td .Ov-h').css('width', width);
    }

    function renderTotalSalary(total: number) {
        const remaining = MAX_SALARY_CUTOFF - total;
        const color = total < MAX_SALARY_CUTOFF ? '#0d8d40' : '#f33131';
        const css = {
            'color': color,
            'font-size': 10,
            'font-weight': 500
        };
        
        const elem = $(`<li class="Inlineblock Mend-lg Ta-c">
            <span class="Fw-b Fz-35">${Utils.toDollarFormat(total)}</span>
            <em class="Block F-shade Fz-xs">Total Salary - (${Utils.toDollarFormat(remaining)} available)</em>
        </li>`);
        elem.css(css);

        $(SELECTORS.TEAM_CARD_STATS).append(elem);
    }

    function renderSalaryTool(pageState: PageState) {
        console.log("rendering bbfbl tool...");
        if (pageState.canDisplayTool === null) {
            pageState.canDisplayTool = PageDetector.isPlayerPage();
        }
        if (!pageState.canDisplayTool) {
            return;
        }
        const buttonClasses = "Btn Btn-short Mend-med js-salary-tool-trigger salary-tool-trigger";
        const trigger = $(`<a class="${buttonClasses}">Salary Worksheet</a>`);
    
        SalaryTool.setupContainer();
    
        const triggerAnchor = $(".Bdrbot .Ta-end");
        trigger.on("click", function(e) {
            SalaryTool.onTriggerClick(e);
        });
        triggerAnchor.append(trigger);
    
        // Make it easy to dismiss
        $("body *:not('.salary-tool-trigger')").on("click", function(e) {
            const isWithinTool = $(e.target).closest(".salary-tool").length > 0 || $(e.target).closest(".player-col").length > 0;
            const isTrigger = $(e.target).hasClass("salary-tool-trigger");
            const isCancel = $(e.target).hasClass("cancel");
            if (!isWithinTool && !isTrigger && !isCancel) {
                $(".salary-tool").removeClass("show");
                $(".salary-tool-trigger").removeClass("active");
            }
        });
        
        SalaryTool.renderToolBody();
        SalaryTool.setupAutoComplete();
        SalaryTool.setupCancelButton();
        SalaryTool.calculateSalaryForYear();
        SalaryTool.prepopulateTool();
    }
    
})










async function fetchSalariesFromRemote(): Promise<PlayerSalary[]> {
    const response = await fetch(URLS.SALARIES_CSV);
    const data = await response.text();
    const rows = data.split("\n").map(row => row.split(","));
    rows.shift(); // remove the header row
    
    bbfbl_salaries = rows.map(row => ({
        name: row[0].trim(),
        salary24_25: 0, // Not available in CSV
        salary25_26: parseInt(row[1].trim()),
        salary26_27: 0, // Not available in CSV
        salary27_28: 0, // Not available in CSV
        yahoo_id: parseInt(row[5].trim())
    }));
    
    console.log("BBFBL: Salaries from remote:", bbfbl_salaries);
    return bbfbl_salaries;
}


async function fetchSalaries(): Promise<PlayerSalary[]> {
    const cacheDate = new Date().getTime();
    console.log("fetching salaries...");
    
    return new Promise<PlayerSalary[]>((resolve, reject) => {
        chrome.storage.local.clear();
        chrome.storage.local.get([STORAGE_KEYS.SALARIES, STORAGE_KEYS.CACHE_DATE], function(result) {
            if (result[STORAGE_KEYS.SALARIES] && result[STORAGE_KEYS.CACHE_DATE] && !Utils.isExpired(result[STORAGE_KEYS.CACHE_DATE])) {
                console.log("bbfbl: using cached salaries:", result[STORAGE_KEYS.CACHE_DATE]);
                bbfbl_salaries = result[STORAGE_KEYS.SALARIES] as PlayerSalary[];
                resolve(bbfbl_salaries);
                return;
            } else {
                chrome.storage.local.clear();
                console.log("sending request for salaries...");
                
                return fetch(URLS.SALARIES_API, {
                    mode: "cors",     
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(res => res.json())
                .then(data => {
                    console.log("bbfbl: using remote salaries", data);
                    const state = {
                        [STORAGE_KEYS.SALARIES]: data,
                        [STORAGE_KEYS.CACHE_DATE]: cacheDate
                    };
                    chrome.storage.local.clear();
                    chrome.storage.local.set(state, function() {
                        console.log("bbfbl: setting salaries to local storage");
                        bbfbl_salaries = data as PlayerSalary[];
                        resolve(bbfbl_salaries);
                    });
                })
                .catch(err => {
                    console.log(err);
                    console.log("bbfbl: using salaries from extension");
                    bbfbl_salaries = salariesLocal as PlayerSalary[];
                    console.log("SALARIES:", bbfbl_salaries);
                    resolve(bbfbl_salaries);
                });         
            }
        });
    });    
}