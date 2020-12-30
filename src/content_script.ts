import * as $ from 'jquery';
import salariesLocal from './salaries';
import * as _ from 'lodash';
import "jquery-ui/ui/widgets/autocomplete";



let bbfbl_salaries;
const MAX_SALARY_CUTOFF = 139000000;
const playerSelector = '.ysf-player-name'; 
$(async function() {
    
    
    let canDisplaySalaries = null
    let canDisplayTool = null
    let url = window.location.href
    

    const isPlayerListPage = window.location.pathname.indexOf("/players") > 0
    const isResearchPage = window.location.pathname.indexOf("/buzzindex") > 0 || window.location.pathname.indexOf("/research") 
    const isPlayerPage = !isNaN(parseInt(window.location.pathname.split("/")[3], 10))

    bbfbl_salaries = await fetchSalaries()
    setInterval(renderBbfbl, 500);
    
    function renderBbfbl() {
        if ($("body").hasClass('bbfbl') && url == window.location.href) {
            return;
        }

        renderSalaries()
        renderSalaryTool()
        if (isPlayerListPage) {
            // alert("player Page")
            renderSalaryFilter()
        }
        $("body").addClass('bbfbl')
        url = window.location.href
    }

    function renderSalaries() {
        if (canDisplaySalaries === null) {
            const isSalariesLoaded = !!bbfbl_salaries
            if (isSalariesLoaded && (isPlayerListPage || isResearchPage || isPlayerPage)) {
                canDisplaySalaries = true
            } else {
                canDisplaySalaries = false
            }
        }

        if (!canDisplaySalaries) {
            return;
        }

        console.log("rendering bbfbl salary...")
        const $players = $(playerSelector);
        const teamSalaries = [];

        $players.each(function() {
            const $this = $(this);
            const href = $this.find('a').attr('href');

            if (!href) return;
            const playerData : any = _.find(bbfbl_salaries, { yahoo_id: getId(href) });
            const value = playerData ? playerData.salary20_21 : 0;
            $this.append(renderSalary(value))
            $this.data("bbfbl-salary", value);
            $this.addClass('bbfbl-salaried');
            teamSalaries.push(value);
        })
        const hasSalaryDisplayed = $("#team-card-info .bbfbl-total-salary").length > 0;
        if (!hasSalaryDisplayed) {
            const totalSalary = sum(teamSalaries);
            renderTotalSalary(totalSalary);
        }
        const width  = window.location.href.indexOf('players') > 0 ? 230 : 255
        $('td .Ov-h ').css('width', width)
    }

    function sum(values: number[]) {
        return values.reduce((total, salary) => { return total + salary}, 0);
    }
    function renderTotalSalary(total: number) {
        const color = total < MAX_SALARY_CUTOFF ? '#0d8d40' : '#f33131'
        const css = {
            'color': color,
            'font-size': 10,
            'font-weight': 500
        }
        const elem = $(`<span class='bbfbl-total-salary'>${toDollarFormat(total)}</span>`);
        elem.css(css);
        $('#team-card-info .Pstart-lg li')
        .eq(0)
        .append(elem);
    }

    function renderSalaryTool() {
        console.log("rendering bbfbl tool...")
        if (canDisplayTool === null) {
            const isPlayerPage = !isNaN(parseInt(window.location.pathname.split("/")[3], 10))
            canDisplayTool = isPlayerPage
        }
        if (!canDisplayTool) {
            return
        }
        const buttonClasses = "Btn Btn-short Mend-med js-salary-tool-trigger salary-tool-trigger"
        const trigger = $(`<a class="${buttonClasses}">Salary Worksheet</a>`)
    
        setupContainer()
    
        const triggerAnchor = $(".Bdrbot .Ta-end")
        trigger.on("click", function(e) {
            onSalaryToolTriggerClick(e)
        })
        triggerAnchor.append(trigger)
    
        // Make it easy to dismiss
        $("body *:not('.salary-tool-trigger')").on("click", function(e) {
            const isWithinTool = $(e.target).closest(".salary-tool").length > 0 || $(e.target).closest(".player-col").length > 0 
            const isTrigger = $(e.target).hasClass("salary-tool-trigger")
            const isCancel = $(e.target).hasClass("cancel")
            if (!isWithinTool && !isTrigger && !isCancel) {
                $(".salary-tool").removeClass("show")
                $(".salary-tool-trigger").removeClass("active")
            }
        })
        
        renderToolBody()
        setupAutoComplete()
        setupCancelButton()
        calculateSalaryForYear()
        prepopulateSalaryTool()
    }
    
})

function renderSalary(str) {
    const css = {
        'color': '#0d8d40',
        'font-size': 10,
        'font-weight': 500
    }
    const $el = $(`<span>${toDollarFormat(str)}</span>`);
    $el.css(css);
    return $el;
}




function toDollarFormat(str) {
    if (!str) return "-"
    if (str === '???')
        return str;
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
    });
    return formatter.format(str)
}

function getId(href: string): number {
    const fragments = href.split('/');
    return parseInt(fragments[fragments.length - 1])
}


function renderSalaryFilter() {
    console.log("rendering filter")
    renderSalaryFilterInput()
    setupSalaryFiltering()
}

function renderSalaryFilterInput() {
    if ($(".js-salary-filter-container").length > 0) {
        return;
    }
    const template = $(`
                <div class="Grid-u Mend-med js-salary-filter-container" style="margin-left: 15px;">
                    <label for="bbfbl-salary" class="Control-label No-p">Max Salary</label>
                    <input class="js-salary-filter Input Input-med" type="number" maxlength="9" min="0" style="width:125px;"  placeholder="Filter Salaries" />
                </div>
    `);
    const anchor = $("#playerfilter .selects");
    anchor.append(template);
}
 function setupSalaryFiltering() {
     console.log("setting up filters")
     function onFilterChange() {
        let maxString = <string>$(this).val();
        let max = parseInt(maxString)
        if (!max) {
            max = 80000000;
        }
        // console.log(max)
        const players = $(playerSelector);
        players.closest("tr").show();
        players.filter(function () {
            let salary = $(this).data("bbfbl-salary")
            // console.log(salary, max)
            return salary >= max
        })
        .closest("tr")
        .hide();
     }
     $(".js-salary-filter").on("keyup", _.debounce(onFilterChange, 1500))
 }


function setupContainer() {
    const toolContainer = $('<div class="js-salary-tool-container salary-tool arrow box"></div>')
    const toolAnchor = $("header.Bdrbot")
    toolContainer.insertAfter(toolAnchor)
    return toolContainer
}

function onSalaryToolTriggerClick(e: JQuery.Event) {
    $(e.target).toggleClass("active")
    var toolContainer = $(".salary-tool")
    toolContainer.toggleClass("show")
}

function renderToolBody() {
    
    var contentContainer = $('<div class="tool-content ui-widget"></div>')
    let table = `
                <table>
                <thead>
                    <tr>
                        <th>Player</td>
                        <th>Salary 2020 - 2021</td>
                        <th>Salary 2021 - 2022</td>
                        <th>Salary 2022 - 2023</td>
                        <th>Salary 2023 - 2024</td>            
                    </tr>
                </thead>
                <tbody>`
    const $players = $('.ysf-player-name');
    for (var i = 0; i < $players.length; i++) { 
        let row = `<tr class="player-row player-row-${i}">
                        <td class="player-col"><input class="player-input player-${i}"></td>
                        <td class="salary salary-20"></td>
                        <td class="salary salary-21"></td>
                        <td class="salary salary-22"></td>
                        <td class="salary salary-23"></td>
                  </tr>`
        table += row
    }

    let footer = `</tbody>
                    <tfoot>
                        <tr>
                            <td class="salary-footer xt"><strong>Total</strong></td>
                            <td class="salary-footer salary-20-sum"></td>
                            <td class="salary-footer salary-21-sum"></td>
                            <td class="salary-footer salary-22-sum"></td>
                            <td class="salary-footer salary-23-sum"></td>
                        </tr>
                    </tfoot>
                    </table>`
    table += footer
    contentContainer.append(table)
    $(".salary-tool").append(contentContainer)
}

function setupAutoComplete() {
    var source = bbfbl_salaries.map(s => {
        return { 
                    label: s.name, 
                    value: s.name, 
                    id: s.yahoo_id, 
                    salary19_20: s.salary20_21,
                    salary20_21: s.salary21_22,
                    salary21_22: s.salary22_23,
                    salary22_23: s.salary23_24,
                    salares: [s.salary20_21, s.salary21_22, s.salary22_23, s.salary23_24]
                }
    })
    $(".player-input").autocomplete({
        source: source,
        minLength: 2,
        select: function(event, ui) {
            const wrapper = generatePlayerWrapper(ui.item.label)

            var row = $(this).closest(".player-row")
            row.find(".player-col").append(wrapper)
            
            // Replace with static selection
            $(this).hide()
            row.find("td.salary").text("")
            row.find("td.salary")
                .each(function(i, el) {
                    $(el).text(toDollarFormat(ui.item.salares[i]))
                    $(el).data("salary", ui.item.salares[i])
                })
            
            row.find(".cancel").addClass("active")
            
            // Need to recalc whenever new selection is made
            calculateSalaryForYear()
            //  Reset raw selection
            $(this).val("")
            return false;
        } 
    })
}

function calculateSalaryForYear() {
    var totals = [".salary-20", ".salary-21", ".salary-22", ".salary-23"]

    totals.forEach(function(year) {
        let sum = 0;
        $(year).each(function() {
            const salary = $(this).data("salary");
            if (salary) {
                sum += salary
            }
        })
        const sumEl = $(year + "-sum")
        sumEl.text(toDollarFormat(sum))
        if (sum > MAX_SALARY_CUTOFF) {
            sumEl.addClass("warning")
        } else {
            sumEl.removeClass("warning")
        }
    })

}

function setupCancelButton() {
    $(".player-col").on("click", ".cancel",  function() {

        const row = $(this).closest(".player-row")
        row.hide();
        row.find("input").show()
        row.find("td.salary").text("").data("salary", 0)
        row.find(".player-display-wrap").remove();
        calculateSalaryForYear()
        row.show()
    })
}

function isPlayerElement(el) {
    const href = getHref(el)
    return href != null
}

function getHref(el) {
    const $el = $(el);
    return $el.find('a').attr('href');
}

function getPlayerSalaryInfo(el) {
    const href = getHref(el)
    return _.find(bbfbl_salaries, { yahoo_id: getId(href) });
}

function prepopulateSalaryTool() {
    const playerSelector = '.ysf-player-name';
    // Track index of players we find ont he page
    let playerIdx = 0;
    $(playerSelector).each(function(i) {
        if (!isPlayerElement(this)) {
            return
        }
        // Update row for player
        const playerData : any = getPlayerSalaryInfo(this)
        if (!playerData) {
            console.log("Missing salary for:", this, playerData)
            return
        }
        var row = $(".salary-tool .player-row").eq(playerIdx);
        row.find(".player-input").hide();
        
        const wrapper = generatePlayerWrapper(playerData.name)
        row.find(".player-col").append(wrapper)
        
        // Append salaries
        var salares = [playerData.salary20_21, playerData.salary21_22, playerData.salary22_23, playerData.salary23_24]
        row.find("td.salary")
        .each(function(n, el) {
            $(el).text(toDollarFormat(salares[n]))
            $(el).data("salary", salares[n])
        })
        row.find(".cancel").addClass("active")
        playerIdx++
    })
    calculateSalaryForYear()
}

function generatePlayerWrapper(label) {
    const wrapperClass = "player-display-wrap"        
    const wrapper = $(`<div><span>${label}</span><span class="cancel">x</span></div>`)
    wrapper.addClass(wrapperClass)
    return wrapper
}

function isExpired(d) {
    const ttl = 1000 * 60 * 60 * 24;
    let now = new Date().getTime();
    return now - d > ttl
}
async function fetchSalaries() {
    const cacheDate = new Date().getTime();
    console.log("fetching salaries...");
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["bbfblSalaries", "cacheDate"], function(result) {
            if (result.bbfblSalaries && result.cacheDate && !isExpired(result.cacheDate)) {
                console.log("bbfbl: using local storage salaries:", result.cacheDate)
                bbfbl_salaries = result.bbfblSalaries;
                resolve(bbfbl_salaries)
                return;
            } else {
                const url = "https://bbfbl-chrome.azurewebsites.net/salaries"
                console.log("sending request for salries...")
                return fetch(url, {
                    mode: "cors",     
                    headers: {
                        'Content-Type': 'application/json'
                     }
                  })
                    .then(res => res.json())
                    .then(data => {
                        console.log("bbfbl: using remote salaries", data)
                        chrome.storage.local.clear()
                        chrome.storage.local.set({ bbfblSalaries: data, cacheDate: cacheDate }, function() {
                            console.log("bbfbl: setting salaries to local storage")
                            bbfbl_salaries = data
                            resolve(data);
                    })
                })
                .catch(err => {
                    console.log(err);
                    console.log("bbfbl: using salaries from extension");
                    bbfbl_salaries = salariesLocal;
                    resolve(bbfbl_salaries);
                })         
            }
        })
    })    
}